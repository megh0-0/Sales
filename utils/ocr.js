const axios = require('axios');
const sharp = require('sharp');

/**
 * Extract text AND detect visual metadata for high-precision parsing
 */
async function extractTextAndRotate(imageSource) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.VISION_API_KEY || process.env.vision_api_key;
  if (!apiKey) throw new Error('Google Vision API Key not found.');

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

    rawBuffer = await sharp(rawBuffer).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).toBuffer();
    const base64Image = rawBuffer.toString('base64');

    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const payload = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION' }]
      }]
    };

    const response = await axios.post(visionUrl, payload);
    const detections = response.data.responses[0].textAnnotations;
    
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
      rotatedBuffer = await sharpImg.jpeg({ quality: 85 }).toBuffer();
    }
    
    return { detections, rotatedImage: rotatedBuffer };
  } catch (error) {
    console.error('OCR/Rotate Error:', error.message);
    throw error;
  }
}

/**
 * Intelligent visual-spatial parser for business cards
 */
function parseCardVisual(detections) {
  if (!detections || detections.length === 0) return null;

  console.log('--- STARTING VISUAL-SPATIAL PARSING ---');
  
  // The first detection is the full text. We use the others (fragments) to reconstruct visual lines.
  const fragments = detections.slice(1);
  
  // Group fragments into visual lines based on Y-coordinates
  let visualLines = [];
  fragments.forEach(f => {
    const y = f.boundingPoly.vertices[0].y || 0;
    const h = (f.boundingPoly.vertices[2].y || 0) - y;
    const text = f.description;
    
    let line = visualLines.find(l => Math.abs(l.y - y) < 10);
    if (line) {
      line.text += ' ' + text;
      line.height = Math.max(line.height, h);
    } else {
      visualLines.push({ text, y, height: h });
    }
  });

  // Sort lines by vertical position
  visualLines.sort((a, b) => a.y - b.y);

  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  const designationKeywords = ['Officer', 'Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Chief', 'Lead', 'Associate', 'Representative'];
  const companySuffixes = ['Ltd', 'Limited', 'Pvt', 'Inc', 'Corp', 'Group', 'Industries', 'Solutions', 'Associates', 'Trading', 'Contractors', 'Agency', 'Company', 'Co.'];
  const pinRegex = /\b\d{4,6}\b/;

  // 1. Identify Emails & Phones (Easy)
  const fullText = detections[0].description;
  data.emails = [...new Set((fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase()))];
  data.phoneNumbers = [...new Set((fullText.match(/(?:\+|00)?(?:\d[.\s-]?){8,15}/g) || []).filter(p => {
    const d = p.replace(/\D/g, '');
    return d.length >= 8 && d.length <= 13;
  }).map(p => p.trim()))];

  // 2. Identify Designation
  let desigLineIdx = -1;
  for (let i = 0; i < visualLines.length; i++) {
    const l = visualLines[i];
    if (designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(l.text))) {
      data.designation = l.text;
      desigLineIdx = i;
      break;
    }
  }

  // 3. Identify Contact Person Name
  // Never a designation. Usually the line above designation or the largest font line that isn't company.
  if (desigLineIdx > 0) {
    const above = visualLines[desigLineIdx - 1].text;
    // Check if line above looks like a name (not a designation, not too long)
    if (!designationKeywords.some(k => above.toLowerCase().includes(k.toLowerCase())) && above.length < 40) {
      data.contactPersonName = above;
    }
  }
  
  if (!data.contactPersonName) {
    const nameLine = visualLines.find(l => {
      const words = l.text.split(' ').length;
      return words >= 2 && words <= 4 && !/\d/.test(l.text) && !l.text.includes('@') && 
             !designationKeywords.some(k => l.text.toLowerCase().includes(k.toLowerCase()));
    });
    if (nameLine) data.contactPersonName = nameLine.text;
  }

  // 4. Identify Company Name
  // Priority 1: Line with corporate suffix
  const suffixLine = visualLines.find(l => companySuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l.text)));
  if (suffixLine) {
    data.companyName = suffixLine.text;
  } else {
    // Priority 2: Tallext text (largest font) that isn't name or designation
    const sortedByHeight = [...visualLines].sort((a, b) => b.height - a.height);
    const tallest = sortedByHeight.find(l => 
      l.text !== data.contactPersonName && 
      l.text !== data.designation && 
      !l.text.includes('@') && 
      !/\d{5,}/.test(l.text)
    );
    if (tallest) data.companyName = tallest.text;
  }

  // 5. Multi-Address with "Gap Detection"
  const addressLines = visualLines.filter(l => 
    l.text !== data.companyName && l.text !== data.contactPersonName && l.text !== data.designation &&
    !data.emails.some(e => l.text.toLowerCase().includes(e)) && 
    !data.phoneNumbers.some(p => l.text.includes(p)) &&
    (l.text.includes(',') || pinRegex.test(l.text) || /Plot|Unit|Office|Road|Street|Floor|Dhaka|Chittagong/i.test(l.text))
  );

  if (addressLines.length > 0) {
    let currentBlock = [];
    addressLines.forEach((l, idx) => {
      let isNewBlock = false;
      if (idx > 0) {
        const prev = addressLines[idx - 1];
        const gap = l.y - (prev.y + prev.height);
        // If vertical gap is > 3x the average line height, it's a new address
        if (gap > (prev.height * 2.5) || /Office|Branch|Factory|Head/i.test(l.text)) {
          isNewBlock = true;
        }
      }

      if (isNewBlock && currentBlock.length > 0) {
        data.addresses.push({ street: currentBlock.join(', '), area: '', city: '' });
        currentBlock = [l.text];
      } else {
        currentBlock.push(l.text);
      }
    });
    if (currentBlock.length > 0) data.addresses.push({ street: currentBlock.join(', '), area: '', city: '' });
  }

  // Final Cleanup
  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];
  
  console.log('--- FINAL PRO PARSED DATA ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndRotate, parseCardVisual };
