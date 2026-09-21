import { db } from './src/db/index.ts';
import { garments } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

async function run() {
  const g = await db.select().from(garments).where(eq(garments.id, '15-2736'));
  if (!g.length) {
    console.log("Not found");
    return;
  }
  const feedback = g[0].structural_feedback;
  console.log("Processing feedback for 15-2736");
  
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const prompt = `The reviewer provided this feedback for garment 15-2736:
"""
${feedback}
"""

Extract and update the existing fields in the garments table:
- garment_type: "Half-Zip Pullover"
- hashtags: merge/add the hashtags like "#print, #piping, #waistband_drawstring"
- gnw_weight: "190gm/m2"
- fabric_material: reflect "S.Cafe coffee yarn (anti-odour, anti-bacteria), PU (Polyurethane / 聚氨酯)"
- description: "Hugo Boss Green Men (BGM) Half-Zip Pullover with rubber print graphics, contrast piping, and waistband drawstring with stopper."
- remark_memo: "Rubber print (no embroidery). Internal fabric code F-670. S.Cafe coffee yarn. Waistband drawstring with stopper."

Return ONLY valid JSON with keys matching garments columns:
{
  "garment_type": "Half-Zip Pullover",
  "hashtags": "#print, #piping, #waistband_drawstring",
  "gnw_weight": "190gm/m2",
  "fabric_material": "S.Cafe coffee yarn, PU (Polyurethane)",
  "description": "Hugo Boss Green Men (BGM) Half-Zip Pullover with rubber print graphics, contrast piping, and waistband drawstring with stopper.",
  "remark_memo": "Rubber print (no embroidery). Internal fabric code F-670. S.Cafe anti-odour/anti-bacteria coffee yarn. Waistband drawstring with stopper."
}`;

  let updates;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    updates = JSON.parse(response.text || '{}');
  } catch (e) {
    console.log("Fallback to direct parsed object");
    updates = {
      garment_type: "Half-Zip Pullover",
      hashtags: "#print, #piping, #waistband_drawstring",
      gnw_weight: "190gm/m2",
      fabric_material: "S.Cafe coffee yarn, PU (Polyurethane / 聚氨酯)",
      description: "Hugo Boss Green Men (BGM) Half-Zip Pullover with rubber print graphics, contrast piping, and waistband drawstring with stopper.",
      remark_memo: "Rubber print (no embroidery). Internal fabric code F-670. S.Cafe anti-odour/anti-bacteria coffee yarn. Waistband drawstring with stopper."
    };
  }
  
  await db.update(garments)
    .set({
      ...updates,
      status: 'Approved',
      reviewer_feedback: feedback,
      structural_feedback: '' // cleared
    })
    .where(eq(garments.id, '15-2736'));

  console.log("Updated garment 15-2736 successfully with approved changes:", updates);
  process.exit(0);
}
run();
