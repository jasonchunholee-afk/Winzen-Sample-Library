const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const cleanOCR = `async function runGeminiOCR(imageBuffer: Buffer, garmentId: string) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const base64 = imageBuffer.toString('base64');
    
    const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
    const glossary = await db.select().from(abbreviation_library);
    const rulesText = activeRules.map(r => \`[\${r.rule_code} \${r.rule_type.toUpperCase()}] \${r.rule_title}: \${r.rule_instruction} (FORBIDDEN: \${r.example_negative || 'N/A'})\`).join('\\n');
    const glossaryText = glossary.map(g => \`\${g.term}: \${g.expansion_en} | \${g.expansion_zh || ''} (\${g.functional_notes || ''})\`).join('\\n');

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

CRITICAL RULES:
\${rulesText}

GLOSSARY:
\${glossaryText}

Return ONLY valid JSON with non-null extracted fields.\`;

    let response;
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
}`;

// Replace whatever is between async function runGeminiOCR and app.post("/api/upload"
const startIndex = code.indexOf('async function runGeminiOCR');
const endIndex = code.indexOf('app.post("/api/upload"');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + cleanOCR + '\n\n  ' + code.substring(endIndex);
  fs.writeFileSync('server.ts', code);
  console.log("Cleanly replaced runGeminiOCR in server.ts");
} else {
  console.error("Indices not found:", startIndex, endIndex);
}
