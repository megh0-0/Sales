const axios = require('axios');
const sharp = require('sharp');
const jsQR = require('jsqr');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Extract text, detect visual metadata, and scan for QR codes with 3-pass preprocessing
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.VISION_API_KEY;

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

    // Fast pass for QR Code
    let qrData = null;
    try {
      const { data, info } = await sharp(rawBuffer)
        .resize(800, 800, { fit: 'inside' })
        .grayscale()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (code) qrData = code.data;
    } catch (e) {}

    // Optimized Buffer for OCR - Essential for speed
    const visionBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    let fullText = '';
    let detections = [];

    // Always try to get text from Vision API as a high-quality fallback/hint
    if (apiKey && apiKey !== 'your_vision_api_key') {
      try {
        const base64Image = visionBuffer.toString('base64');
        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
        const payload = {
          requests: [{
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        };
        const response = await axios.post(visionUrl, payload, { timeout: 8000 });
        const visionData = response.data.responses[0];
        detections = visionData?.textAnnotations || [];
        fullText = detections.length > 0 ? detections[0].description : '';
      } catch (e) {
        console.error('Vision API Error:', e.message);
      }
    } else {
      console.warn('WARNING: Vision API Key is missing. Fallback results will be limited.');
    }
    
    return { fullText, detections, rotatedImage: visionBuffer, qrData };
  } catch (error) {
    console.error('Pre-process Error:', error.message);
    throw error;
  }
}

/**
 * Advanced vCard Parser
 */
function parseVCard(vcard) {
  const data = { contactPersonName: '', companyName: '', designation: '', phoneNumbers: [], emails: [], addresses: [] };
  const lines = vcard.split(/\r?\n/);
  
  lines.forEach(line => {
    const parts = line.split(':');
    if (parts.length < 2) return;
    const key = parts[0].toUpperCase();
    const val = parts.slice(1).join(':').trim();

    if (key.startsWith('FN')) data.contactPersonName = val;
    else if (key.startsWith('N') && !data.contactPersonName) data.contactPersonName = val.replace(/;/g, ' ').trim();
    else if (key.startsWith('ORG')) data.companyName = val.split(';')[0].replace(/;/g, '').trim();
    else if (key.startsWith('TITLE')) data.designation = val;
    else if (key.startsWith('TEL')) data.phoneNumbers.push(val.replace(/[^\d+]/g, ''));
    else if (key.startsWith('EMAIL')) data.emails.push(val.toLowerCase());
    else if (key.startsWith('ADR')) {
      const adr = val.split(';');
      data.addresses.push({ street: adr[2] || '', area: adr[4] || adr[3] || '', city: adr[5] || adr[3] || '' });
    }
  });
  
  data.phoneNumbers = [...new Set(data.phoneNumbers.filter(p => p.length > 5))];
  data.emails = [...new Set(data.emails)];
  return data;
}

/**
 * Hybrid Intelligence Parser (AI + Local)
 */
async function parseCardIntelligence(fullText, detections, qrData, contextLeads = [], imageBuffer = null) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (geminiKey && geminiKey !== 'your_google_api_key' && imageBuffer) {
    const modelsToTry = ["gemini-2.5-flash", "gemini-flash-latest"];
    const base64Image = imageBuffer.toString('base64');

    for (const modelName of modelsToTry) {
      console.log(`Attempting Gemini AI via REST (${modelName})...`);
      try {
        // Using Manual REST API call to bypass SDK 404 bugs
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
        
        const payload = {
          contents: [{
            parts: [
              { text: "EXTRACT BUSINESS CARD DATA. JSON ONLY. NO SLOGANS. SCHEMA: {\"companyName\":\"\",\"contactPersonName\":\"\",\"designation\":\"\",\"phoneNumbers\":[],\"emails\":[],\"addresses\":[{\"street\":\"\",\"area\":\"\",\"city\":\"\"}]}" },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        };

        const response = await axios.post(url, payload, { timeout: 15000 });
        const aiText = response.data.candidates[0].content.parts[0].text;
        const aiResult = JSON.parse(aiText);

        if (aiResult) {
          console.log(`Gemini AI (${modelName}) REST Success.`);
          return {
            companyName: aiResult.companyName || '',
            contactPersonName: aiResult.contactPersonName || '',
            designation: aiResult.designation || '',
            phoneNumbers: Array.isArray(aiResult.phoneNumbers) ? aiResult.phoneNumbers : [],
            emails: Array.isArray(aiResult.emails) ? aiResult.emails : [],
            addresses: Array.isArray(aiResult.addresses) ? aiResult.addresses : []
          };
        }
      } catch (e) {
        const errorDetail = e.response?.data?.error?.message || e.message;
        console.error(`${modelName} REST failed: ${errorDetail}`);
        // Continue to next model or fallback
      }
    }
  }

  // --- STRICT LOCAL FALLBACK ENGINE ---
  console.log("Using Deep Scan Local Fallback...");
  const data = { companyName: '', contactPersonName: '', designation: '', phoneNumbers: [], emails: [], addresses: [] };
  if (qrData && qrData.toUpperCase().includes('BEGIN:VCARD')) {
    Object.assign(data, parseVCard(qrData));
  } 

  const cleanText = fullText || '';
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  
  // 1. Basic Data (Regex)
  if (!data.emails.length) data.emails = [...new Set((cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase()))];
  if (!data.phoneNumbers.length) data.phoneNumbers = [...new Set((cleanText.match(/(?:\+|00)?(?:\d[.\s-]?){8,15}/g) || []).map(p => p.trim()))];
  
  // 2. Slogan Filtering (Stricter)
  const sloganBlacklist = ['Quality', 'Service', 'Since', 'Trust', 'Leading', 'ISO', 'Certified', 'Partner', 'World Class', 'Experience', 'Commitment', 'Excellence', 'Best', 'Reliable'];
  const cleanLines = lines.filter(l => !sloganBlacklist.some(s => l.includes(s)));

  // 3. Name & Company
  if (!data.contactPersonName) data.contactPersonName = cleanLines.find(l => /Md\.|Engr\.|Mr\.|Mrs\.|Ms\.|Dr\.|S\.M\.|Sheikh|Mohammad/i.test(l)) || cleanLines[0] || '';
  if (!data.companyName) data.companyName = cleanLines.find(l => /Ltd|Limited|Corp|Inc|Group|Pvt|Enterprise/i.test(l)) || cleanLines[1] || '';

  // 4. Numeric-Strict Address Detection (Addresses must have a number)
  if (data.addresses.length === 0) {
    const addrKeywords = ['Road', 'House', 'Plot', 'Block', 'Floor', 'Avenue', 'Street', 'Building', 'No.', 'Dhaka', 'Chittagong', 'Gulshan', 'Uttara'];
    const addrLines = cleanLines.filter(l => 
      addrKeywords.some(k => l.includes(k)) && 
      /\d/.test(l) && // MUST contain a digit (House #, Road #, etc.)
      l.length > 8
    );
    
    if (addrLines.length > 0) {
      addrLines.forEach(line => data.addresses.push({ street: line, area: '', city: '' }));
    } else if (cleanLines.length > 2) {
      data.addresses = [{ street: cleanLines.slice(-2).join(', '), area: '', city: '' }];
    }
  }

  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];
  return data;
}

module.exports = { extractTextAndRotate, parseCardIntelligence };
