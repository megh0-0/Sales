const axios = require('axios');
const sharp = require('sharp');
const jsQR = require('jsqr');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Extract text, detect visual metadata, and scan for QR codes with 3-pass preprocessing
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.VISION_API_KEY;
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

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

    // ONLY call Vision API if Gemini is NOT available (to save time)
    if (!hasGemini && apiKey && apiKey !== 'your_vision_api_key') {
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
      // Format: PO Box; Extended; Street; Locality; Region; Postcode; Country
      data.addresses.push({ street: adr[2] || '', area: adr[4] || adr[3] || '', city: adr[5] || adr[3] || '' });
    }
  });
  
  data.phoneNumbers = [...new Set(data.phoneNumbers.filter(p => p.length > 5))];
  return data;
}

/**
 * Hybrid Intelligence Parser (AI + Local)
 */
async function parseCardIntelligence(fullText, detections, qrData, contextLeads = [], imageBuffer = null) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (geminiKey && geminiKey !== 'your_google_api_key' && imageBuffer) {
    console.log("Initiating Gemini AI Multimodal Parsing...");
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const promptParts = [
        `EXTRACT BUSINESS CARD DATA INTO JSON.
        
        STRICT FILTERS:
        1. ADDRESSES: Extract EVERY location (Head Office, Branch, etc.). 
        2. NO SLOGANS: Strictly ignore "Quality First", "Since 19xx", "Your partner in...", "ISO Certified" or mission statements.
        3. DESIGNATION: Must be a job title like Manager, Director, Engineer.
        4. CLEANUP: No icons (📞, ✉️), no labels like "Web:" or "Mob:".
        
        SCHEMA:
        {
          "companyName": "",
          "contactPersonName": "",
          "designation": "",
          "phoneNumbers": [],
          "emails": [],
          "addresses": [{"street": "House/Road/Plot", "area": "Area", "city": "City"}]
        }

        INPUTS:
        - QR Data: ${qrData || 'N/A'}
        - OCR Hint: ${fullText || 'N/A'}`,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: "image/jpeg"
          }
        }
      ];

      const result = await model.generateContent(promptParts);
      const aiResult = JSON.parse(result.response.text());
      
      return {
        companyName: aiResult.companyName || '',
        contactPersonName: aiResult.contactPersonName || '',
        designation: aiResult.designation || '',
        phoneNumbers: Array.isArray(aiResult.phoneNumbers) ? aiResult.phoneNumbers : [],
        emails: Array.isArray(aiResult.emails) ? aiResult.emails : [],
        addresses: Array.isArray(aiResult.addresses) ? aiResult.addresses : []
      };
    } catch (e) {
      console.error("Gemini AI Error, falling back...", e.message);
    }
  }

  // --- LOCAL FALLBACK ENGINE (Only if Gemini Fails) ---
  const data = { companyName: '', contactPersonName: '', designation: '', phoneNumbers: [], emails: [], addresses: [] };
  if (qrData && qrData.toUpperCase().includes('BEGIN:VCARD')) {
    Object.assign(data, parseVCard(qrData));
  } 
  const lines = (fullText || '').split('\n').map(l => l.trim()).filter(l => l.length > 1);
  if (!data.emails.length) data.emails = [...new Set((fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase()))];
  if (!data.phoneNumbers.length) data.phoneNumbers = [...new Set((fullText.match(/(?:\+|00)?(?:\d[.\s-]?){8,15}/g) || []).map(p => p.trim()))];
  if (!data.contactPersonName) data.contactPersonName = lines.find(l => /Md\.|Engr\.|Mr\.|Mrs\./i.test(l)) || lines[0] || '';
  if (!data.companyName) data.companyName = lines.find(l => /Ltd|Limited|Corp|Inc|Group/i.test(l)) || lines[1] || '';
  return data;
}

module.exports = { extractTextAndRotate, parseCardIntelligence };
