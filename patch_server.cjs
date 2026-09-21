const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Add GoogleGenAI and structural_change_requests imports
if (!serverCode.includes('@google/genai')) {
  serverCode = `import { GoogleGenAI, Type } from '@google/genai';\n` + serverCode;
}

if (!serverCode.includes('structural_change_requests')) {
  serverCode = serverCode.replace(
    'import { users, garments, images, summaries } from "./src/db/schema.ts";',
    'import { users, garments, images, summaries, structural_change_requests } from "./src/db/schema.ts";'
  );
}

const processFeedbackEndpoint = `
  app.post("/api/garments/:id/process-feedback", async (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY missing" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: \`Analyze this garment feedback from Jennifer: "\${feedback}". 
Identify:
1. Immediate Data Updates: simple non-structural changes that map directly to existing fields (e.g. changing color, size).
2. Structural Requests: requests for new fields, tags, or database structure (e.g., "Add a Zipper Type column").
3. Dependent Updates: data changes that rely on those new structural fields (e.g. "Set zipper to YKK").\`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              immediate_updates: {
                type: Type.OBJECT,
                description: "Key-value pairs of non-structural updates to apply immediately (e.g. { color: 'Blue' })"
              },
              structural_requests: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of new structural database field requests"
              },
              dependent_updates: {
                type: Type.OBJECT,
                description: "Key-value pairs of updates that depend on the requested structural changes"
              }
            },
            required: ["immediate_updates", "structural_requests", "dependent_updates"]
          }
        }
      });
      
      let parsed;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch (e) {
        parsed = { immediate_updates: {}, structural_requests: [], dependent_updates: {} };
      }
      
      // Apply immediate non-structural changes
      if (Object.keys(parsed.immediate_updates || {}).length > 0) {
        await db.update(garments)
          .set(parsed.immediate_updates)
          .where(eq(garments.id, id));
      }
      
      // Save structural changes for Jason's approval
      if ((parsed.structural_requests && parsed.structural_requests.length > 0) || 
          (parsed.dependent_updates && Object.keys(parsed.dependent_updates).length > 0)) {
        await db.insert(structural_change_requests).values({
          garment_id: id,
          raw_feedback: feedback,
          structural_requests: JSON.stringify(parsed.structural_requests || []),
          dependent_updates: JSON.stringify(parsed.dependent_updates || {}),
          status: 'pending'
        });
      }
      
      res.json({ success: true, processed: parsed });
    } catch (e) {
      console.error("Gemini processing error:", e);
      res.status(500).json({ error: e.message });
    }
  });
`;

// Insert the endpoint before the regular feedback endpoint
if (!serverCode.includes('/process-feedback')) {
  serverCode = serverCode.replace(
    'app.post("/api/garments/:id/feedback",',
    processFeedbackEndpoint + '\n  app.post("/api/garments/:id/feedback",'
  );
}

fs.writeFileSync('server.ts', serverCode);
console.log("Patched server.ts successfully");
