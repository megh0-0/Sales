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
 * Intelligent parser to extract fields from visiting card text, 
 * specifically optimized for multiple addresses and phone numbers.
 * @param {string} text 
 */
function parseCardText(text) {
  console.log('--- STARTING REFINED PARSING ---');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  // 1. Precise Email Extraction
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = text.match(emailRegex);
  if (foundEmails) {
    data.emails = [...new Set(foundEmails.map(e => e.toLowerCase()))];
    console.log('Emails found:', data.emails);
  }

  // 2. Precise Phone Extraction (Filtering out addresses)
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    data.phoneNumbers = [...new Set(foundPhones.map(p => p.trim()).filter(p => {
      const digits = p.replace(/\D/g, '');
      // Business card phones are typically 10-12 digits. PIN codes are 6.
      return digits.length >= 8 && digits.length <= 13;
    }))];
    console.log('Phones found:', data.phoneNumbers);
  }

  // 3. Designation & Name Identification
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
    // Fallback: search for a short line without numbers that looks like a name
    const nameLine = lines.find(l => {
      const words = l.split(' ').length;
      return words >= 2 && words <= 4 && !/\d/.test(l) && !/[@:.]/.test(l) && l.length < 30;
    });
    if (nameLine) data.contactPersonName = nameLine;
  }

  // 4. Company Name Identification
  const companySuffixes = ['Limited', 'Ltd', 'Pvt', 'Inc', 'Corp', 'Enterprises', 'Solutions', 'Systems', 'Group', 'Associates', 'Co.', 'Industries', 'Trading', 'Contractors'];
  const suffixLine = lines.find(l => companySuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l)));
  if (suffixLine) {
    data.companyName = suffixLine;
  } else if (lines.length > 0) {
    // If not name, take the first line. If first is name, take second.
    data.companyName = (lines[0] === data.contactPersonName) ? (lines[1] || '') : lines[0];
  }

  // 5. SMARTER MULTI-ADDRESS EXTRACTION
  const addressStartMarkers = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Head Office', 'Branch Office', 'Works:', 'Address:', 'Addr:', 'Site:', 'Regd.'];
  const pinRegex = /\b\d{5,6}\b/;

  // We iterate through lines and try to "segment" them into address blocks
  let addressBlocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip lines that are definitely NOT addresses
    if (data.emails.includes(line.toLowerCase())) continue;
    if (data.phoneNumbers.includes(line)) continue;
    if (line === data.companyName || line === data.contactPersonName || line === data.designation) continue;
    if (line.toLowerCase().includes('website')) continue;
    if (line.toLowerCase().startsWith('www.')) continue;

    const startsNewAddress = addressStartMarkers.some(marker => line.toLowerCase().includes(marker.toLowerCase()));
    const prevWasPin = i > 0 && pinRegex.test(lines[i-1]);

    // If this line starts a new address or follows a PIN, it's a new block
    if ((startsNewAddress || prevWasPin) && currentBlock.length > 0) {
      addressBlocks.push(currentBlock.join(', '));
      currentBlock = [line];
    } else if (line.length > 5 || pinRegex.test(line)) {
      currentBlock.push(line);
    }
  }
  // Push the final block
  if (currentBlock.length > 0) {
    addressBlocks.push(currentBlock.join(', '));
  }

  // Clean and filter address blocks
  data.addresses = addressBlocks
    .filter(addr => addr.length > 15) // Addresses must be long enough
    .map(addr => {
      let city = '';
      const pinMatch = addr.match(pinRegex);
      if (pinMatch) {
        // City is often the word right before the PIN code
        const beforePin = addr.split(pinMatch[0])[0].trim();
        const parts = beforePin.split(/[,\s-]/).filter(p => p.length > 2 && !/\d/.test(p));
        if (parts.length > 0) city = parts[parts.length - 1];
      }
      return { street: addr, area: '', city: city };
    });

  // Ensure at least one empty row if none found
  if (data.addresses.length === 0) {
    data.addresses.push({ street: '', area: '', city: '' });
  }

  console.log('--- FINAL PARSED DATA ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndCrop, parseCardText };
