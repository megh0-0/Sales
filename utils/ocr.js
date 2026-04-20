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

    // Resize for memory efficiency
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
    
    return { 
      fullText: detections && detections.length > 0 ? detections[0].description : '',
      detections: detections || [], 
      rotatedImage: rotatedBuffer 
    };
  } catch (error) {
    console.error('OCR/Rotate Error:', error.message);
    throw error;
  }
}

/**
 * Enhanced parsing logic using both raw text and visual coordinates
 */
function parseCardIntelligence(fullText, detections) {
  if (!fullText) return null;

  console.log('--- STARTING PRECISION HYBRID PARSING ---');
  
  const data = {
    companyName: '',
    contactPersonName: '',
    designation: '',
    phoneNumbers: [],
    emails: [],
    addresses: []
  };

  // 1. Precise Emails (from full text)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  data.emails = [...new Set((fullText.match(emailRegex) || []).map(e => e.toLowerCase()))];

  // 2. Precise Phones (from full text)
  const phoneRegex = /(?:\+|00)?(?:\d[.\s-]?){7,15}/g;
  data.phoneNumbers = [...new Set((fullText.match(phoneRegex) || []).filter(p => {
    const d = p.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 13;
  }).map(p => p.trim()))];

  // --- Visual Line Reconstruction ---
  const fragments = (detections || []).slice(1);
  let visualLines = [];
  fragments.forEach(f => {
    const y = f.boundingPoly.vertices[0].y || 0;
    const h = (f.boundingPoly.vertices[2].y || 0) - y;
    const text = f.description.trim();
    if (text.length < 1 || /^[\W_]+$/.test(text)) return; // Filter noise like ") . ,"

    let line = visualLines.find(l => Math.abs(l.y - y) < 8); // Tight tolerance
    if (line) {
      line.text += ' ' + text;
      line.height = Math.max(line.height, h);
    } else {
      visualLines.push({ text, y, height: h });
    }
  });
  visualLines.sort((a, b) => a.y - b.y);

  // 3. Designation Identification
  const designationKeywords = ['Officer', 'Manager', 'Director', 'CEO', 'Founder', 'Engineer', 'Sales', 'Executive', 'Owner', 'Partner', 'President', 'Consultant', 'Proprietor', 'V.P.', 'Chief', 'Lead', 'Associate', 'Representative', 'Prop.'];
  
  let desigLineIdx = -1;
  for (let i = 0; i < visualLines.length; i++) {
    if (designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(visualLines[i].text))) {
      data.designation = visualLines[i].text;
      desigLineIdx = i;
      break;
    }
  }

  // 4. Contact Person Name
  // Logic: Not a designation, not an email, not too long, usually above designation
  const isDesignation = (txt) => designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(txt));
  
  if (desigLineIdx > 0) {
    const above = visualLines[desigLineIdx - 1].text;
    if (!isDesignation(above) && !above.includes('@') && above.length < 35 && !/\d{5,}/.test(above)) {
      data.contactPersonName = above;
    }
  }

  if (!data.contactPersonName) {
    const potential = visualLines.find(l => {
      const words = l.text.split(' ').length;
      return words >= 2 && words <= 4 && !/\d/.test(l.text) && !l.text.includes('@') && !isDesignation(l.text);
    });
    if (potential) data.contactPersonName = potential.text;
  }

  // 5. Company Name Identification
  const corpSuffixes = ['Ltd', 'Limited', 'Pvt', 'Inc', 'Corp', 'Group', 'Industries', 'Solutions', 'Associates', 'Trading', 'Contractors', 'Agency', 'Co.', 'Works'];
  
  const suffixLine = visualLines.find(l => corpSuffixes.some(s => new RegExp(`\\b${s}\\b`, 'i').test(l.text)));
  if (suffixLine) {
    data.companyName = suffixLine.text;
  } else {
    // Largest font that isn't name/designation/email/address
    const tallest = [...visualLines].sort((a, b) => b.height - a.height).find(l => 
      l.text !== data.contactPersonName && 
      l.text !== data.designation && 
      !l.text.includes('@') && 
      !/\d{7,}/.test(l.text) &&
      !/Dhaka|Road|Street|Plot|Office/i.test(l.text)
    );
    if (tallest) data.companyName = tallest.text;
  }

  // 6. Address Segmentation (Gap + Keyword based)
  const pinRegex = /\b\d{4,6}\b/;
  const cityKeywords = ['Dhaka', 'Chittagong', 'Khulna', 'Sylhet', 'Rajshahi', 'Mumbai', 'Delhi', 'Dubai'];

  const addressLines = visualLines.filter(l => 
    l.text !== data.companyName && l.text !== data.contactPersonName && l.text !== data.designation &&
    !data.emails.some(e => l.text.toLowerCase().includes(e)) && 
    !data.phoneNumbers.some(p => l.text.includes(p)) &&
    (l.text.includes(',') || pinRegex.test(l.text) || /Plot|Unit|Office|Road|Street|Floor|Dhaka|Factory|Branch/i.test(l.text))
  );

  if (addressLines.length > 0) {
    let currentBlock = [];
    addressLines.forEach((l, idx) => {
      let isNewBlock = false;
      if (idx > 0) {
        const prev = addressLines[idx - 1];
        const verticalGap = l.y - (prev.y + prev.height);
        // If vertical gap is large (> 2.5x height), it's a new location
        if (verticalGap > (prev.height * 2.5) || /Office|Branch|Factory|Head Office|Works/i.test(l.text)) {
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

  // Final Cleanup: Try to extract city from street string
  data.addresses = data.addresses.map(addr => {
    const streetTxt = addr.street;
    let city = '';
    const cityMatch = cityKeywords.find(c => new RegExp(`\\b${c}\\b`, 'i').test(streetTxt));
    if (cityMatch) city = cityMatch;
    else {
      const parts = streetTxt.split(/[,\s-]/).filter(p => p.length > 3 && !/\d/.test(p));
      if (parts.length > 0) city = parts[parts.length - 1];
    }
    return { ...addr, city };
  });

  if (data.addresses.length === 0) data.addresses = [{ street: '', area: '', city: '' }];

  console.log('--- FINAL INTELLIGENT PARSED DATA ---');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

module.exports = { extractTextAndRotate, parseCardIntelligence };
