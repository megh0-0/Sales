const axios = require('axios');
const sharp = require('sharp');

/**
 * Extract text AND detect visual metadata for high-precision parsing
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.VISION_API_KEY || process.env.vision_api_key;
  if (!apiKey) throw new Error('Google Vision API Key not found.');

  try {
    let rawBuffer = null;
    if (Buffer.isBuffer(imageSource)) {
      rawBuffer = imageSource;
    } else if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
      rawBuffer = Buffer.from(response.data, 'binary');
    } else if (typeof imageSource === 'string') {
      const fs = require('fs');
      rawBuffer = fs.readFileSync(imageSource);
    }

    // Resize for memory efficiency
    rawBuffer = await sharp(rawBuffer).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).toBuffer();
    const base64Image = rawBuffer.toString('base64');

    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const payload = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION' }]
      }]
    };

    const response = await axios.post(visionUrl, payload);
    const visionData = response.data.responses[0];
    const detections = visionData.textAnnotations;
    
    let rotatedBuffer = null;
    if (detections && detections.length > 0) {
      const v = detections[0].boundingPoly.vertices;
      const angle = Math.atan2((v[1].y || 0) - (v[0].y || 0), (v[1].x || 0) - (v[0].x || 0)) * (180 / Math.PI);
      
      let rotation = 0;
      if (angle > 45 && angle <= 135) rotation = -90;
      else if (angle > 135 || angle <= -135) rotation = 180;
      else if (angle < -45 && angle >= -135) rotation = 90;

      let sharpImg = sharp(rawBuffer);
      if (rotation !== 0) sharpImg = sharpImg.rotate(rotation);
      const metadata = await sharpImg.metadata();
      if (metadata.height > metadata.width) sharpImg = sharpImg.rotate(90);

      rotatedBuffer = await sharpImg.jpeg({ quality: 85 }).toBuffer();
    }
    
    return { 
      fullText: detections && detections.length > 0 ? detections[0].description : '',
      detections: detections || [], 
      rotatedImage: rotatedBuffer 
    };
  } catch (error) {
    console.error('OCR/Rotate Error:', error.message);
    throw error;
  }
}

/**
 * Clean and split text into meaningful lines
 */
function getCleanLines(fullText) {
  return fullText.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1 && !/^[).,.\- ]+$/.test(l));
}

/**
 * Intelligent parser optimized for Bangladeshi business cards.
 * Incorporates deep knowledge of BD naming styles, prefixes, and corporate hierarchy.
 */
function parseCardIntelligence(fullText, detections) {
  if (!fullText) return null;

  console.log('--- STARTING BANGLADESHI PRECISION PARSING ---');
  
  const rawLines = getCleanLines(fullText);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  // 1. Core Data Extraction (Emails, Phones, URLs)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;

  data.emails = [...new Set((fullText.match(emailRegex) || []).map(e => e.toLowerCase()))];
  data.phoneNumbers = [...new Set((fullText.match(phoneRegex) || []).filter(p => {
    const d = p.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 13;
  }).map(p => p.trim()))];

  const filteredLines = rawLines.filter(l => 
    !data.emails.includes(l.toLowerCase()) && 
    !data.phoneNumbers.some(p => l.includes(p)) &&
    !l.toLowerCase().includes('www.') &&
    !l.toLowerCase().includes('http')
  );

  // 2. Bangladeshi Name Identification
  // Knowledge Base: Prefixes and common Surnames in BD
  const bdNamePrefixes = ['Md.', 'Mohammad', 'Most.', 'Mst.', 'Engr.', 'Dr.', 'Adv.', 'Ar.', 'S.M.', 'Sheikh', 'Mr.', 'Mrs.', 'Ms.'];
  const bdSurnames = ['Ahmed', 'Ali', 'Hossain', 'Islam', 'Khan', 'Rahman', 'Sheikh', 'Das', 'Ghosh', 'Roy', 'Sen', 'Talukder', 'Uddin', 'Chowdhury', 'Miah', 'Akter', 'Begum'];
  
  // Find lines that look like a Name
  const potentialNames = filteredLines.filter(l => {
    const words = l.split(' ');
    const hasPrefix = bdNamePrefixes.some(p => l.includes(p));
    const hasSurname = bdSurnames.some(s => l.includes(s));
    // A name is typically 2-5 words, doesn't have many numbers, and often has a prefix or surname
    return words.length >= 2 && words.length <= 6 && !/\d{3,}/.test(l) && (hasPrefix || hasSurname);
  });

  // 3. Designation Identification (Knowledge of BD Corporate Hierarchy)
  const bdDesignationKeywords = [
    'Chairman', 'Managing Director', 'CEO', 'Proprietor', 'Partner', 'Director',
    'General Manager', 'GM', 'DGM', 'AGM', 'Manager', 'Assistant Manager',
    'Executive', 'Officer', 'Marketing', 'Sales', 'Territory', 'TSM', 'ASM',
    'Engineer', 'Site Engineer', 'Project', 'PD', 'PM', 'Commercial', 'Consultant',
    'Representative', 'Trainee', 'MT', 'Technician', 'Prop.'
  ];

  let desigIdx = -1;
  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    // A line is a designation if it has key terms and IS NOT already a high-confidence name
    if (bdDesignationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(line))) {
      // Logic: If it starts with 'Md.' or 'Engr.', it's a name, not a designation line 
      // (unless it's something like "Engr. Dept", but usually "Engr. [Name]" is the person)
      const isActuallyName = bdNamePrefixes.slice(0, 8).some(p => line.startsWith(p));
      if (!isActuallyName) {
        data.designation = line;
        desigIdx = i;
        break;
      }
    }
  }

  // Assign the best name candidate
  if (desigIdx > 0) {
    const above = filteredLines[desigIdx - 1];
    if (potentialNames.includes(above)) {
      data.contactPersonName = above;
    }
  }
  if (!data.contactPersonName && potentialNames.length > 0) {
    data.contactPersonName = potentialNames[0];
  }

  // 4. Company Name Identification
  const bdCorpSuffixes = ['Ltd', 'Limited', 'Pvt', 'Inc', 'Corp', 'Group', 'Industries', 'Solutions', 'Associates', 'Trading', 'Contractors', 'Agency', 'Co.', 'Equipments', 'Marine', 'Automation', 'Enterprise'];
  
  // Look for corporate suffix in lines that aren't Name/Designation
  const suffixMatch = filteredLines.find(l => 
    l !== data.contactPersonName && 
    l !== data.designation && 
    bdCorpSuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l))
  );

  if (suffixMatch) {
    data.companyName = suffixMatch;
  } else {
    // If no suffix, pick the most prominent non-personal line
    const firstGood = filteredLines.find(l => 
      l !== data.contactPersonName && 
      l !== data.designation && 
      l.length > 3 &&
      !l.includes(',') &&
      !/\d{4}/.test(l) &&
      !bdNamePrefixes.some(p => l.startsWith(p))
    );
    data.companyName = firstGood || '';
  }

  // 5. Bangladeshi Multi-Address Extraction
  // Keywords used in BD address blocks
  const bdAddrMarkers = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Mansion', 'Lane', 'Dewanhat', 'Mooring', 'Dhaka', 'Chattogram', 'Chittagong', 'Bangladesh', 'Strand', 'Road', 'Floor', 'Avenue', 'Block', 'Sector'];
  const bdPinRegex = /\b\d{4}\b/; // Bangladesh uses 4 digit postal codes

  const addressLines = filteredLines.filter(l => 
    l !== data.companyName && l !== data.contactPersonName && l !== data.designation &&
    (l.includes(',') || bdPinRegex.test(l) || bdAddrMarkers.some(m => l.toLowerCase().includes(m.toLowerCase())))
  );

  if (addressLines.length > 0) {
    let blocks = [];
    let current = [];
    
    addressLines.forEach((line, idx) => {
      // Bangladesh Specific Address Breaking
      const isNewOffice = /Office|Branch|Factory|Head Office|H\.O\.|B\.O\.|Works/i.test(line);
      const prevEnded = idx > 0 && bdPinRegex.test(addressLines[idx - 1]);
      const startsWithNumber = /^\d+/.test(line); // e.g. "110, Strand Road"

      if ((isNewOffice || (startsWithNumber && prevEnded)) && current.length > 0) {
        blocks.push(current.join(', '));
        current = [line];
      } else {
        current.push(line);
      }
    });
    if (current.length > 0) blocks.push(current.join(', '));

    data.addresses = blocks.map(b => {
      let city = '';
      const cities = ['Dhaka', 'Chittagong', 'Chattogram', 'Khulna', 'Sylhet', 'Rajshahi', 'Gazipur', 'Narayanganj', 'Comilla'];
      const cityMatch = cities.find(c => new RegExp(`\\b${c}\\b`, 'i').test(b));
      if (cityMatch) city = cityMatch;
      return { street: b, area: '', city: city };
    });
  }

  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];

  console.log('--- INTELLIGENT PARSING RESULT ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndRotate, parseCardIntelligence };
