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
 * Simple parser to extract fields from visiting card text
 * @param {string} text 
 */
function parseCardText(text) {
  console.log('Parsing extracted text...');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: [{ street: '', area: '', city: '' }]
  };

  // Regex patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+?\d{1,4}[\s-])?\(?\d{3,5}[\s-]?\d{3,4}[\s-]?\d{3,4}/g; // Adjusted for more global formats

  // Extract Emails
  const foundEmails = text.match(emailRegex);
  if (foundEmails) {
    data.emails = [...new Set(foundEmails)];
    console.log('Found Emails:', data.emails);
  }

  // Extract Phones
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    data.phoneNumbers = [...new Set(foundPhones.map(p => p.trim()))];
    console.log('Found Phones:', data.phoneNumbers);
  }

  // Heuristics for Name, Company, Designation
  if (lines.length > 0) {
    data.contactPersonName = lines[0];
    
    const designationKeywords = ['Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner', 'Head', 'Associate'];
    
    // Try to find designation in lines 1-3
    let designationIndex = -1;
    for (let i = 1; i < Math.min(4, lines.length); i++) {
      if (designationKeywords.some(k => lines[i].toLowerCase().includes(k.toLowerCase()))) {
        designationIndex = i;
        break;
      }
    }

    if (designationIndex !== -1) {
      data.designation = lines[designationIndex];
      // If designation found, company is often the line before or after
      if (designationIndex > 1) {
        data.companyName = lines[designationIndex - 1];
      } else if (lines[designationIndex + 1]) {
        data.companyName = lines[designationIndex + 1];
      }
    } else if (lines[1]) {
      // Fallback: second line is often company or designation
      data.companyName = lines[1];
      if (lines[2]) data.designation = lines[2];
    }
  }

  console.log('Final Parsed Data:', JSON.stringify(data));
  return data;
}

module.exports = { extractText, parseCardText };
