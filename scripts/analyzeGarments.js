import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const imagesDir = path.join(process.cwd(), 'public/images_ai');

async function main() {
  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpg'));
  
  const groups = {};
  for (const file of files) {
    const id = file.split(' ')[0].replace('.jpg', '');
    if (!groups[id]) groups[id] = [];
    groups[id].push(file);
  }

  const results = [];
  
  for (const [id, images] of Object.entries(groups)) {
    console.log(`Analyzing ${id}...`);
    
    const imageParts = images.map(img => {
      const data = fs.readFileSync(path.join(imagesDir, img));
      return {
        inlineData: { data: data.toString("base64"), mimeType: "image/jpeg" }
      };
    });

    const prompt = `
      You are an expert fashion archivist reading a physical manufacturing label (Winzen Apparel Limited format) and looking at photos of the physical garment.
      Extract EVERY field exactly as written on the label. 
      If a field is empty/blank on the label, leave it empty or null in the main field, BUT for 'Color' and 'G.N.W' (weight), if they are empty, you MUST provide an AI estimation based on the photos and fabric type, and set the corresponding 'is_ai_estimated' flag to true.
      
      For the fabric, break it down into yarn count, material, and construction.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [prompt, ...imageParts],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              buyer: { type: Type.STRING },
              season: { type: Type.STRING },
              sales: { type: Type.STRING },
              y_style_no: { type: Type.STRING },
              cust_style_no: { type: Type.STRING },
              garment_type: { type: Type.STRING },
              washing: { type: Type.STRING },
              
              fabric_raw: { type: Type.STRING },
              fabric_yarn_count: { type: Type.STRING },
              fabric_material: { type: Type.STRING },
              fabric_construction: { type: Type.STRING },
              
              gnw_weight: { type: Type.STRING, description: "Weight. If empty, estimate it." },
              gnw_is_ai_estimated: { type: Type.BOOLEAN },
              
              sample_job_no: { type: Type.STRING },
              color: { type: Type.STRING, description: "Color. If empty on label, estimate from photo." },
              color_is_ai_estimated: { type: Type.BOOLEAN },
              size: { type: Type.STRING },
              
              description: { type: Type.STRING },
              remark_memo: { type: Type.STRING },
              print_datetime: { type: Type.STRING },
              
              jennifer_emulator_raw: { type: Type.STRING, description: "Your overall qualitative summary and analysis of the garment, exactly like the original AI generation." }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text);
      results.push({ id, ...parsed });
      console.log(`✅ ${id} analysis complete.`);
    } catch (err) {
      console.error(`❌ Failed to analyze ${id}:`, err.message);
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'public/garments_data.json'), 
    JSON.stringify(results, null, 2)
  );
  console.log('Done!');
}

main();
