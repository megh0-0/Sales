const axios = require('axios');
const sharp = require('sharp');

/**
 * Extract text AND detect crop hints for auto-cropping
 * @param {string} imageSource Local path or Buffer or URL
 * @returns {Promise<{text: string, croppedImage: Buffer | null}>} 
 */
async function extractTextAndCrop(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || 
                 process.env.VISION_API_KEY || 
                 process.env.vision_api_key ||
                 process.env.google_vision_api_key;

  if (!apiKey) {
    throw new Error('Google Vision API Key not found. Please ensure GOOGLE_VISION_API_KEY or VISION_API_KEY is set in Render Environment.');
  }

  try {
    let base64Image = '';
    let rawBuffer = null;

    // If it's a URL, download it
    if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
      rawBuffer = Buffer.from(response.data, 'binary');
    } else {
      const fs = require('fs');
      rawBuffer = fs.readFileSync(imageSource);
    }
    base64Image = rawBuffer.toString('base64');

    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    const payload = {
      requests: [
        {
          image: { content: base64Image },
          features: [
            { type: 'TEXT_DETECTION' },
            { type: 'CROP_HINTS' }
          ]
        }
      ]
    };

    const response = await axios.post(visionUrl, payload);
    const visionData = response.data.responses[0];
    
    // 1. Text Extraction
    const detections = visionData.textAnnotations;
    const fullText = detections && detections.length > 0 ? detections[0].description : '';

    // 2. Auto-Cropping Logic
    let croppedBuffer = null;
    const cropHints = visionData.cropHintsAnnotation?.cropHints;
    
    if (cropHints && cropHints.length > 0 && rawBuffer) {
      const hint = cropHints[0].boundingPoly.vertices;
      const metadata = await sharp(rawBuffer).metadata();
      
      // Calculate crop box (handling normalized or pixel coords)
      const left = Math.max(0, hint[0].x || 0);
      const top = Math.max(0, hint[0].y || 0);
      const right = hint[1].x || metadata.width;
      const bottom = hint[2].y || metadata.height;
      const width = Math.min(metadata.width - left, right - left);
      const height = Math.min(metadata.height - top, bottom - top);

      if (width > 50 && height > 50) {
        croppedBuffer = await sharp(rawBuffer)
          .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
          .toBuffer();
        console.log('Auto-cropping successful.');
      }
    }
    
    return { text: fullText, croppedImage: croppedBuffer };
  } catch (error) {
    console.error('OCR/Crop Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Improved parser to extract fields from visiting card text
 * @param {string} text 
 */
function parseCardText(text) {
  console.log('Parsing extracted text with multi-field heuristics...');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = text.match(emailRegex);
  if (foundEmails) data.emails = [...new Set(foundEmails.map(e => e.toLowerCase()))];

  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    data.phoneNumbers = [...new Set(foundPhones.map(p => p.trim()).filter(p => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 13;
    }))];
  }

  const designationKeywords = ['Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner', 'Head', 'Associate', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Vice President', 'Chief', 'Lead', 'Prop'];
  let designationIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lines[i]))) {
      data.designation = lines[i];
      designationIdx = i;
      break;
    }
  }

  if (designationIdx > 0) {
    data.contactPersonName = lines[designationIdx - 1];
  } else {
    const nameLine = lines.find(l => {
      const words = l.split(' ').length;
      return words >= 2 && words <= 4 && !/\d/.test(l) && !/[@:.]/.test(l);
    });
    if (nameLine) data.contactPersonName = nameLine;
  }

  const companySuffixes = ['Limited', 'Ltd', 'Pvt', 'Inc', 'Corp', 'Enterprises', 'Solutions', 'Systems', 'Group', 'Associates', 'Co.'];
  const suffixLine = lines.find(l => companySuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l)));
  if (suffixLine) {
    data.companyName = suffixLine;
  } else if (lines.length > 0) {
    data.companyName = lines[0] === data.contactPersonName ? (lines[1] || '') : lines[0];
  }

  const addressStartKeywords = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Head Office', 'Branch Office', 'Works:'];
  const pinRegex = /\b\d{5,6}\b/;
  const potentialAddrLines = lines.filter(l => 
    !data.emails.includes(l.toLowerCase()) && !data.phoneNumbers.includes(l) &&
    l !== data.companyName && l !== data.contactPersonName && l !== data.designation &&
    (l.length > 5 || pinRegex.test(l))
  );

  if (potentialAddrLines.length > 0) {
    let currentAddr = [];
    potentialAddrLines.forEach((line, idx) => {
      const startsWithKeyword = addressStartKeywords.some(k => new RegExp(`^${k}`, 'i').test(line));
      const prevHadPin = idx > 0 && pinRegex.test(potentialAddrLines[idx - 1]);
      if ((startsWithKeyword || prevHadPin) && currentAddr.length > 0) {
        data.addresses.push({ street: currentAddr.join(', '), area: '', city: '' });
        currentAddr = [line];
      } else {
        currentAddr.push(line);
      }
    });
    if (currentAddr.length > 0) data.addresses.push({ street: currentAddr.join(', '), area: '', city: '' });
  }

  data.addresses = data.addresses.filter(a => a.street.length > 10).map(a => {
    const pinMatch = a.street.match(pinRegex);
    if (pinMatch) {
      const parts = a.street.split(pinMatch[0])[0].split(/[,\s-]/).filter(p => p.length > 2);
      if (parts.length > 0) a.city = parts[parts.length - 1];
    }
    return a;
  });

  if (data.addresses.length === 0) data.addresses.push({ street: '', area: '', city: '' });
  return data;
}

module.exports = { extractTextAndCrop, parseCardText };
