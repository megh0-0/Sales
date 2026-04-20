const axios = require('axios');

/**
 * Extract text from image using Google Cloud Vision REST API
 * @param {string} imageSource Local path or Buffer or URL
 * @returns {Promise<string>} Full text extracted
 */
async function extractText(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || 
                 process.env.VISION_API_KEY || 
                 process.env.vision_api_key ||
                 process.env.google_vision_api_key;

  if (!apiKey) {
    throw new Error('Google Vision API Key not found. Please ensure GOOGLE_VISION_API_KEY or VISION_API_KEY is set in Render Environment.');
  }

  console.log(`Starting OCR via REST API...`);
  try {
    let base64Image = '';

    // If it's a URL, download it
    if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
      base64Image = Buffer.from(response.data, 'binary').toString('base64');
    } else {
      // If it's a local file path
      const fs = require('fs');
      const imageFile = fs.readFileSync(imageSource);
      base64Image = Buffer.from(imageFile).toString('base64');
    }

    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    const payload = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }]
        }
      ]
    };

    const response = await axios.post(visionUrl, payload);
    const detections = response.data.responses[0].textAnnotations;
    const fullText = detections && detections.length > 0 ? detections[0].description : '';
    
    console.log('OCR REST Extraction successful.');
    return fullText;
  } catch (error) {
    console.error('Google Vision REST Error:', error.response?.data || error.message);
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
    addresses: [] // Start with empty, will populate
  };

  // 1. Extract Emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = text.match(emailRegex);
  if (foundEmails) data.emails = [...new Set(foundEmails.map(e => e.toLowerCase()))];

  // 2. Extract Phone Numbers (Multiple)
  // Matches: +91 9876543210, 022-1234567, 9876-543210
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    data.phoneNumbers = [...new Set(foundPhones
      .map(p => p.trim())
      .filter(p => {
        const digits = p.replace(/\D/g, '');
        // Filter: typically 7-13 digits for actual numbers
        return digits.length >= 7 && digits.length <= 13;
      })
    )];
    console.log('Total Phones Extracted:', data.phoneNumbers.length);
  }

  // 3. Extract Designation & Name
  const designationKeywords = [
    'Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 
    'Owner', 'Partner', 'Head', 'Associate', 'President', 'Consultant', 'Proprietor',
    'V.P.', 'Vice President', 'Chief', 'Lead', 'Prop'
  ];

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
    // Look for first 2-3 word line with no numbers or special chars
    const nameLine = lines.find(l => {
      const words = l.split(' ').length;
      return words >= 2 && words <= 4 && !/\d/.test(l) && !/[@:.]/.test(l);
    });
    if (nameLine) data.contactPersonName = nameLine;
  }

  // 4. Company Name
  const companySuffixes = ['Limited', 'Ltd', 'Pvt', 'Inc', 'Corp', 'Enterprises', 'Solutions', 'Systems', 'Group', 'Associates', 'Co.'];
  const suffixLine = lines.find(l => companySuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l)));
  if (suffixLine) {
    data.companyName = suffixLine;
  } else if (lines.length > 0) {
    data.companyName = lines[0] === data.contactPersonName ? (lines[1] || '') : lines[0];
  }

  // 5. Multi-Address Extraction (Refined)
  const addressStartKeywords = ['Plot', 'Shop', 'Unit', 'Office', 'Factory', 'Building', 'No.', 'H.O.', 'B.O.', 'Head Office', 'Branch Office', 'Works:'];
  const pinRegex = /\b\d{5,6}\b/;

  // Collect potential lines, excluding already identified fields
  const potentialAddrLines = lines.filter(l => 
    !data.emails.includes(l.toLowerCase()) &&
    !data.phoneNumbers.includes(l) &&
    l !== data.companyName &&
    l !== data.contactPersonName &&
    l !== data.designation &&
    (l.length > 5 || pinRegex.test(l))
  );

  if (potentialAddrLines.length > 0) {
    let currentAddr = [];
    potentialAddrLines.forEach((line, idx) => {
      // Logic for starting a new address block:
      // 1. Line starts with a known "Start Keyword"
      // 2. Previous line had a PIN code (addresses usually end with PIN)
      // 3. Current line is significantly separate from the previous one in the array
      const startsWithKeyword = addressStartKeywords.some(k => new RegExp(`^${k}`, 'i').test(line));
      const prevHadPin = idx > 0 && pinRegex.test(potentialAddrLines[idx - 1]);
      
      if ((startsWithKeyword || prevHadPin) && currentAddr.length > 0) {
        data.addresses.push({ street: currentAddr.join(', '), area: '', city: '' });
        currentAddr = [line];
      } else {
        currentAddr.push(line);
      }
    });
    if (currentAddr.length > 0) {
      data.addresses.push({ street: currentAddr.join(', '), area: '', city: '' });
    }
  }

  // Deduplicate and clean addresses
  data.addresses = data.addresses
    .filter(a => a.street.length > 10) // Filter out noise
    .map(a => {
      // Try to extract city (last word before PIN or last word of line)
      const pinMatch = a.street.match(pinRegex);
      if (pinMatch) {
        const parts = a.street.split(pinMatch[0])[0].split(/[,\s-]/).filter(p => p.length > 2);
        if (parts.length > 0) a.city = parts[parts.length - 1];
      }
      return a;
    });

  // Fallback: If no addresses found, ensure at least one empty object
  if (data.addresses.length === 0) {
    data.addresses.push({ street: '', area: '', city: '' });
  }

  console.log('Final Multi-Parsed Data:', JSON.stringify(data));
  return data;
}

module.exports = { extractText, parseCardText };
