import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3) {
  const models = ['gemini-3.8-flash', 'gemini-3.6-flash'];
  for (let i = 0; i < retries; i++) {
    for (const model of models) {
      try {
        console.log(`Attempting with model: ${model} (attempt ${i + 1})`);
        return await ai.models.generateContent({ ...params, model });
      } catch (e: any) {
        console.log(`Failed with ${model}:`, e.message?.slice(0, 100));
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  throw new Error("All models failed");
}

async function test() {
  const imgBuffer = fs.readFileSync('public/images/11S-1906.jpg');
  const base64 = imgBuffer.toString('base64');

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const res = await generateWithRetry(ai, {
    contents: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64
        }
      },
      {
        text: `Perform high-precision OCR on this garment spec sheet / sample tag.
Extract:
- buyer
- season
- cust_style_no
- y_style_no
- garment_type
- washing
- fabric_raw
- gnw_weight
- fabric_yarn_count
- fabric_material
- fabric_construction
- sample_job_no
- color
- size
- print_datetime
- description

Return ONLY valid JSON matching these fields.`
      }
    ],
    config: {
      responseMimeType: 'application/json'
    }
  });

  console.log("OCR RESULT:", res.text);
}
test();
