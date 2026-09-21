const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Replace gemini-2.5-pro with gemini-3.8-flash
serverCode = serverCode.replace(/model:\s*['"]gemini-2\.5-pro['"]/g, "model: 'gemini-3.8-flash'");

// Add OCR helper if not present
if (!serverCode.includes('runGeminiOCR')) {
  const ocrHelper = `
async function runGeminiOCR(imageBuffer: Buffer, garmentId: string) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const base64 = imageBuffer.toString('base64');
    
    // Try gemini-3.8-flash first, fallback to gemini-3.6-flash
    let response;
    const prompt = \`Perform high-precision OCR and garment spec extraction on this garment tag / photo.
Extract:
- buyer: brand/buyer code (e.g. HB, Hugo Boss)
- season: season code
- cust_style_no: customer style number
- y_style_no: factory style number
- garment_type: e.g. T-Shirt, Pullover, Jacket, Polo
- washing: washing / treatment instructions
- fabric_raw: full raw fabric description
- gnw_weight: fabric weight (e.g. 190gm/m2)
- fabric_yarn_count: yarn count (e.g. 32/1)
- fabric_material: fiber composition (e.g. 100% COTTON)
- fabric_construction: construction (e.g. SINGLE JERSEY)
- sample_job_no: sample job order number
- color: garment color
- size: size (e.g. S, M, L, XL)
- print_datetime: tag printing datetime
- description: brief description of the style and features

Return ONLY valid JSON with non-null extracted fields.\`;

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt }
        ],
        config: { responseMimeType: 'application/json' }
      });
    } catch (err) {
      console.warn("Falling back to gemini-3.6-flash for OCR:", err.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt }
        ],
        config: { responseMimeType: 'application/json' }
      });
    }

    if (response && response.text) {
      const parsed = JSON.parse(response.text);
      console.log(\`[Gemini OCR] Successfully extracted specs for \${garmentId}:\`, parsed);
      // Clean up null/empty values
      const updates: any = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (val && typeof val === 'string' && val.trim() !== '') {
          updates[key] = val;
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(garments).set(updates).where(eq(garments.id, garmentId));
      }
      return parsed;
    }
  } catch (err) {
    console.error("[Gemini OCR] Extraction error:", err);
  }
  return null;
}
`;

  // Insert before app.post("/api/upload"
  serverCode = serverCode.replace('app.post("/api/upload"', ocrHelper + '\n  app.post("/api/upload"');
}

// Ensure /api/upload triggers runGeminiOCR in background
if (!serverCode.includes('runGeminiOCR(req.file.buffer, garmentId)')) {
  serverCode = serverCode.replace(
    'res.json({ success: true, filename: saveFilename });',
    `// Run Gemini OCR asynchronously on the uploaded photo
      runGeminiOCR(req.file.buffer, garmentId).catch(err => console.error("Async OCR error:", err));
      res.json({ success: true, filename: saveFilename });`
  );
}

fs.writeFileSync('server.ts', serverCode);
console.log("Patched server.ts with Gemini OCR and model upgrades");
