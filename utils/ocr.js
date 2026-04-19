const vision = require('@google-cloud/vision');
const path = require('path');

// Configure Google Cloud Vision client
// Note: GOOGLE_APPLICATION_CREDENTIALS should point to the JSON key file
// Or the credentials can be passed directly if using service account JSON content
const client = new vision.ImageAnnotatorClient();

/**
 * Extract text from image using Google Cloud Vision
 * @param {string} imagePath Local path or Buffer
 * @returns {Promise<string>} Full text extracted
 */
async function extractText(imagePath) {
  try {
    const [result] = await client.textDetection(imagePath);
    const detections = result.textAnnotations;
    return detections && detections.length > 0 ? detections[0].description : '';
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

/**
 * Simple parser to extract fields from visiting card text
 * @param {string} text 
 */
function parseCardText(text) {
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
  const phoneRegex = /(\+?\d{1,4}[\s-])?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g; // Basic US/Global pattern

  // Extract Emails
  const foundEmails = text.match(emailRegex);
  if (foundEmails) data.emails = [...new Set(foundEmails)];

  // Extract Phones
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) data.phoneNumbers = [...new Set(foundPhones)];

  // Heuristics for Name, Company, Designation
  // Usually the first few lines contain Name, Designation, and Company
  // This is highly variable, but let's try some common patterns
  if (lines.length > 0) {
    // Often Name is the largest/first bold text. We'll take the first line as name for now.
    data.contactPersonName = lines[0];
    
    // Check if second line looks like a designation
    const designationKeywords = ['Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner'];
    if (lines[1] && designationKeywords.some(k => lines[1].includes(k))) {
      data.designation = lines[1];
      if (lines[2]) data.companyName = lines[2];
    } else if (lines[1]) {
      data.companyName = lines[1];
      if (lines[2]) data.designation = lines[2];
    }
  }

  // Address extraction is hard without specialized NLP, but we can try to find City/State
  // For now, we'll put the whole text into street if it's long and contains numbers
  const addressLine = lines.find(l => /\d+/.test(l) && l.length > 15);
  if (addressLine) {
    data.addresses[0].street = addressLine;
  }

  return data;
}

module.exports = { extractText, parseCardText };
