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
  console.log('Parsing extracted text with refined heuristics...');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: [{ street: '', area: '', city: '' }]
  };

  // 1. Extract Emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = text.match(emailRegex);
  if (foundEmails) data.emails = [...new Set(foundEmails.map(e => e.toLowerCase()))];

  // 2. Extract Phone Numbers
  // Matches various formats: +91 9876543210, 022-1234567, etc.
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){8,15}/g;
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    data.phoneNumbers = [...new Set(foundPhones
      .map(p => p.trim())
      .filter(p => {
        const digits = p.replace(/\D/g, '');
        // Filter out strings that are likely just PIN codes or year
        return digits.length >= 8 && digits.length <= 13;
      })
    )];
  }

  // 3. Extract Designation & Name
  const designationKeywords = [
    'Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 
    'Owner', 'Partner', 'Head', 'Associate', 'President', 'Consultant', 'Proprietor',
    'V.P.', 'Vice President', 'Chief', 'Lead'
  ];

  let designationIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lines[i]))) {
      data.designation = lines[i];
      designationIdx = i;
      break;
    }
  }

  // If we found a designation, the line ABOVE it is very often the Name
  if (designationIdx > 0) {
    data.contactPersonName = lines[designationIdx - 1];
    
    // The Company Name is often the line BELOW the designation or at the very top
    if (lines[designationIdx + 1] && !lines[designationIdx + 1].includes('@') && !/\d/.test(lines[designationIdx + 1])) {
      data.companyName = lines[designationIdx + 1];
    }
  }

  // 4. Identify Company Name (Fallback)
  if (!data.companyName) {
    // Look for common company suffixes
    const companySuffixes = ['Limited', 'Ltd', 'Pvt', 'Inc', 'Corp', 'Enterprises', 'Solutions', 'Systems', 'Group', 'Associates'];
    const suffixLine = lines.find(l => companySuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l)));
    if (suffixLine) {
      data.companyName = suffixLine;
    } else if (lines.length > 0) {
      // Often the first line is Company or Name
      data.companyName = lines[0] === data.contactPersonName ? (lines[1] || '') : lines[0];
    }
  }

  // 5. Address Extraction
  const addressKeywords = ['Street', 'Road', 'Ave', 'Blvd', 'Lane', 'Floor', 'Building', 'Plot', 'Phase', 'Industrial', 'Sector', 'Opp', 'Near', 'Area', 'City'];
  const pinRegex = /\b\d{5,6}\b/; // PIN/ZIP code

  const addrLines = lines.filter(l => 
    (addressKeywords.some(k => new RegExp(k, 'i').test(l)) || pinRegex.test(l)) &&
    !data.emails.includes(l.toLowerCase()) &&
    !data.phoneNumbers.includes(l)
  );

  if (addrLines.length > 0) {
    data.addresses[0].street = addrLines.join(', ');
    
    // Try to guess city from PIN code line
    const cityLine = addrLines.find(l => pinRegex.test(l));
    if (cityLine) {
      const parts = cityLine.split(/[,\s-]/).filter(p => p.length > 3 && !/\d/.test(p));
      if (parts.length > 0) data.addresses[0].city = parts[parts.length - 1];
    }
  }

  // Final Cleanup: Remove found phones/emails from Name/Company fields if accidentally assigned
  if (data.contactPersonName && (/\d{5,}/.test(data.contactPersonName) || data.contactPersonName.includes('@'))) {
    data.contactPersonName = '';
  }

  console.log('Improved Parsed Data:', JSON.stringify(data));
  return data;
}

module.exports = { extractText, parseCardText };
