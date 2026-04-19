const vision = require('@google-cloud/vision');
const axios = require('axios');

// Configure Google Cloud Vision client
const client = new vision.ImageAnnotatorClient();

/**
 * Extract text from image using Google Cloud Vision
 * @param {string} imageSource Local path or Buffer or URL
 * @returns {Promise<string>} Full text extracted
 */
async function extractText(imageSource) {
  console.log(`Starting OCR for source: ${imageSource.substring(0, 50)}...`);
  try {
    let imagePayload = imageSource;

    // Check if it's a URL (like from Cloudinary)
    if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      console.log('Downloading image from URL...');
      const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
      imagePayload = Buffer.from(response.data, 'binary');
      console.log('Download complete.');
    }

    const [result] = await client.textDetection(imagePayload);
    const detections = result.textAnnotations;
    const fullText = detections && detections.length > 0 ? detections[0].description : '';
    console.log('OCR Extraction successful. Full text length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('Google Vision API Error:', error.message);
    throw error;
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
