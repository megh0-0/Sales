const axios = require('axios');
const sharp = require('sharp');

/**
 * Extract text AND detect text orientation for auto-rotation
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || 
                 process.env.VISION_API_KEY || 
                 process.env.vision_api_key ||
                 process.env.google_vision_api_key;

  if (!apiKey) {
    throw new Error('Google Vision API Key not found. Please ensure GOOGLE_VISION_API_KEY or VISION_API_KEY is set in Render Environment.');
  }

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
    } else {
      throw new Error('Invalid imageSource type provided to OCR.');
    }

    // Resize for memory efficiency
    rawBuffer = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

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
    const fullText = detections && detections.length > 0 ? detections[0].description : '';

    let rotatedBuffer = null;
    if (detections && detections.length > 0) {
      const v = detections[0].boundingPoly.vertices;
      const angle = Math.atan2((v[1].y || 0) - (v[0].y || 0), (v[1].x || 0) - (v[0].x || 0)) * (180 / Math.PI);
      
      let rotation = 0;
      if (angle > 45 && angle <= 135) rotation = -90;
      else if (angle > 135 || angle <= -135) rotation = 180;
      else if (angle < -45 && angle >= -135) rotation = 90;

      let sharpImg = sharp(rawBuffer).rotate(); 
      if (rotation !== 0) sharpImg = sharpImg.rotate(rotation);
      const metadata = await sharpImg.metadata();
      if (metadata.height > metadata.width) sharpImg = sharpImg.rotate(90);

      rotatedBuffer = await sharpImg.jpeg({ quality: 80 }).toBuffer();
    }
    
    return { text: fullText, rotatedImage: rotatedBuffer };
  } catch (error) {
    console.error('OCR/Rotate Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Intelligent parser optimized for business card layouts
 */
function parseCardText(text) {
  console.log('--- STARTING HIGH-PRECISION PARSING ---');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  // 1. Emails (Structured)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  data.emails = [...new Set((text.match(emailRegex) || []).map(e => e.toLowerCase()))];

  // 2. Phone Numbers (Structured)
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;
  data.phoneNumbers = [...new Set((text.match(phoneRegex) || [])
    .filter(p => {
      const d = p.replace(/\D/g, '');
      return d.length >= 8 && d.length <= 13;
    })
    .map(p => p.trim())
  )];

  // 3. Designation Identification (Keywords)
  const designationKeywords = ['Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Chief', 'Lead', 'Associate'];
  let desigIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lines[i]))) {
      data.designation = lines[i];
      desigIdx = i;
      break;
    }
  }

  // 4. Contact Person Name (prominent line near designation)
  // Usually a short line (2-3 words) with no numbers, near the designation
  const potentialNames = lines.filter(l => {
    const words = l.split(' ').length;
    return words >= 2 && words <= 4 && !/\d/.test(l) && !l.includes('@') && !l.includes('.') && l.length < 30;
  });

  if (desigIdx !== -1 && desigIdx > 0 && potentialNames.includes(lines[desigIdx - 1])) {
    data.contactPersonName = lines[desigIdx - 1];
  } else if (potentialNames.length > 0) {
    data.contactPersonName = potentialNames[0];
  }

  // 5. Company Name (Corporate Suffixes or First prominent non-name line)
  const corpSuffixes = ['Ltd', 'Limited', 'Pvt', 'Inc', 'Corp', 'Group', 'Industries', 'Solutions', 'Associates', 'Trading'];
  const companyLine = lines.find(l => corpSuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l)));
  
  if (companyLine) {
    data.companyName = companyLine;
  } else if (lines.length > 0) {
    // If first line isn't a name/designation/phone, it's usually the company
    const firstGood = lines.find(l => 
      l !== data.contactPersonName && 
      l !== data.designation && 
      !/\d{5,}/.test(l) && 
      !l.includes('@')
    );
    data.companyName = firstGood || '';
  }

  // 6. ADVANCD MULTI-ADDRESS SEGMENTATION
  const addrMarkers = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Head Office', 'Branch', 'Site:', 'Works:', 'Address:', 'Addr:'];
  const pinRegex = /\b\d{5,6}\b/;
  const cityKeywords = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad', 'Ahmedabad', 'Gurgaon', 'Noida', 'Surat', 'Dubai', 'London', 'NY', 'California'];

  let addressLines = lines.filter(l => 
    !data.emails.includes(l.toLowerCase()) && 
    !data.phoneNumbers.includes(l) &&
    l !== data.companyName && 
    l !== data.contactPersonName && 
    l !== data.designation &&
    (l.includes(',') || pinRegex.test(l) || addrMarkers.some(m => l.toLowerCase().includes(m.toLowerCase())) || cityKeywords.some(c => l.toLowerCase().includes(c.toLowerCase())))
  );

  if (addressLines.length > 0) {
    let blocks = [];
    let current = [];
    
    addressLines.forEach((line, idx) => {
      // Split into new block if:
      // 1. Current line starts with an explicit marker (Office, Factory)
      // 2. Previous line had a PIN code (addresses usually end with PIN)
      const isNewStart = addrMarkers.some(m => line.toLowerCase().startsWith(m.toLowerCase()));
      const prevEnded = idx > 0 && pinRegex.test(addressLines[idx - 1]);

      if ((isNewStart || prevEnded) && current.length > 0) {
        blocks.push(current.join(', '));
        current = [line];
      } else {
        current.push(line);
      }
    });
    if (current.length > 0) blocks.push(current.join(', '));

    data.addresses = blocks.map(b => {
      const pinMatch = b.match(pinRegex);
      let city = '';
      if (pinMatch) {
        const parts = b.split(pinMatch[0])[0].split(/[,\s-]/).filter(p => p.length > 3 && !/\d/.test(p));
        if (parts.length > 0) city = parts[parts.length - 1];
      }
      return { street: b, area: '', city: city };
    });
  }

  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];

  console.log('--- FINAL PRO PARSED DATA ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndRotate, parseCardText };
