const axios = require('axios');
const sharp = require('sharp');

/**
 * Extract text AND detect visual metadata for high-precision parsing
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || 
                 process.env.VISION_API_KEY || 
                 process.env.vision_api_key ||
                 process.env.google_vision_api_key;

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
 * Uses a hybrid of text-order and visual font-size analysis.
 */
function parseCardIntelligence(fullText, detections) {
  if (!fullText) return null;

  console.log('--- STARTING ENHANCED BANGLADESHI PARSING ---');
  
  const rawLines = getCleanLines(fullText);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  // --- Visual Mapping for Font Size Detection ---
  const fragments = (detections || []).slice(1);
  let visualLines = [];
  fragments.forEach(f => {
    const v = f.boundingPoly.vertices;
    const y = v[0].y || 0;
    const h = (v[2].y || 0) - y; // Rough height
    const text = f.description.trim();
    
    if (text.length < 1) return;

    let line = visualLines.find(l => Math.abs(l.y - y) < 12);
    if (line) {
      line.text += ' ' + text;
      line.height = Math.max(line.height, h);
    } else {
      visualLines.push({ text, y, height: h });
    }
  });

  // 1. Extract Emails & Phones
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
    !l.toLowerCase().includes('website')
  );

  // 2. Identify Designation
  const desigKeywords = ['Officer', 'Manager', 'Director', 'CEO', 'Founder', 'Sales', 'Executive', 'Owner', 'Partner', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Chief', 'Lead', 'Associate', 'Representative', 'Prop.', 'Chairman', 'Technician'];
  
  let desigIdx = -1;
  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    if (desigKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(line))) {
      if (!/Md\.|Engr\.|Mohammad/i.test(line)) {
        data.designation = line;
        desigIdx = i;
        break;
      }
    }
  }

  // 3. Identify Contact Person Name
  const namePrefixes = ['Engr.', 'Md.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Mohammad', 'S.M.', 'Sheikh'];
  const prefixMatch = filteredLines.find(l => namePrefixes.some(p => l.startsWith(p)));
  if (prefixMatch) {
    data.contactPersonName = prefixMatch;
  } else if (desigIdx > 0) {
    const above = filteredLines[desigIdx - 1];
    if (above.length < 35 && above.split(' ').length >= 2) {
      data.contactPersonName = above;
    }
  }

  // 4. Identify Company Name (Tallest non-personal text)
  const corpSuffixes = ['Ltd', 'Limited', 'Pvt', 'Inc', 'Corp', 'Group', 'Industries', 'Solutions', 'Associates', 'Trading', 'Contractors', 'Agency', 'Co.', 'Equipments', 'Marine', 'Automation', 'Enterprise', 'Works', 'System'];
  
  // Sort visual lines by font height to find the most prominent text
  const sortedByHeight = [...visualLines].sort((a, b) => b.height - a.height);
  
  // Candidates for Company Name: must not be Name, Designation, Email, or Phone
  const companyCandidates = sortedByHeight.filter(l => {
    const txt = l.text.trim();
    if (txt === data.contactPersonName || txt === data.designation) return false;
    if (data.emails.some(e => txt.toLowerCase().includes(e))) return false;
    if (data.phoneNumbers.some(p => txt.includes(p))) return false;
    if (txt.length < 3) return false;
    // Exclude things that look like addresses (starting with Plot, No, etc.)
    if (/Plot|Unit|No|Road|Street|Mansion|Floor/i.test(txt)) return false;
    return true;
  });

  // Pick candidate with corporate suffix first
  const suffixCandidate = companyCandidates.find(l => corpSuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l.text)));
  
  if (suffixCandidate) {
    data.companyName = suffixCandidate.text;
  } else if (companyCandidates.length > 0) {
    // Otherwise pick the tallest text
    data.companyName = companyCandidates[0].text;
  }

  // 5. Multi-Address Extraction
  const addrMarkers = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Mansion', 'Lane', 'Dewanhat', 'Mooring', 'Dhaka', 'Chattogram', 'Chittagong', 'Bangladesh', 'Strand', 'Road', 'Floor', 'Mam Goli'];
  const pinRegex = /\b\d{4,6}\b/;

  const addressLines = filteredLines.filter(l => 
    l !== data.companyName && l !== data.contactPersonName && l !== data.designation &&
    (l.includes(',') || pinRegex.test(l) || addrMarkers.some(m => l.toLowerCase().includes(m.toLowerCase())))
  );

  if (addressLines.length > 0) {
    let blocks = [];
    let current = [];
    
    addressLines.forEach((line, idx) => {
      const isExplicitNew = /Office|Branch|Factory|Head Office|H\.O\.|B\.O\.|Works/i.test(line);
      const startsWithLoc = /Habib|Mansion|Plot|Unit|No|Mam Goli|^\d+/i.test(line);
      const prevEnded = idx > 0 && (pinRegex.test(addressLines[idx - 1]) || addressLines[idx - 1].toLowerCase().includes('bangladesh'));

      if (idx > 0 && (isExplicitNew || (startsWithLoc && prevEnded))) {
        blocks.push(current.join(', '));
        current = [line];
      } else {
        current.push(line);
      }
    });
    if (current.length > 0) blocks.push(current.join(', '));

    data.addresses = blocks.map(b => {
      let city = '';
      const cities = ['Dhaka', 'Chittagong', 'Chattogram', 'Khulna', 'Sylhet', 'Rajshahi'];
      const cityMatch = cities.find(c => new RegExp(`\\b${c}\\b`, 'i').test(b));
      if (cityMatch) city = cityMatch;
      return { street: b, area: '', city: city };
    });
  }

  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];

  console.log('--- FINAL POLISHED DATA ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndRotate, parseCardIntelligence };
