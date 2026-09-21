const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// replace the PUT endpoint logic to include Gemini processing for structural_feedback
const putRegex = /app\.put\("\/api\/garments\/:id", async \(req, res\) => \{[\s\S]*?\}\);/g;

const newPut = `app.put("/api/garments/:id", async (req, res) => {
    const { id } = req.params;
    const g = req.body;
    try {
      // If there is structural_feedback, process it via Gemini
      let immediate_updates = {};
      if (g.structural_feedback && process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: \`Analyze this garment feedback from Jennifer: "\${g.structural_feedback}". 
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
        
        try {
          const parsed = JSON.parse(response.text || '{}');
          immediate_updates = parsed.immediate_updates || {};
          
          if ((parsed.structural_requests && parsed.structural_requests.length > 0) || 
              (parsed.dependent_updates && Object.keys(parsed.dependent_updates).length > 0)) {
            await db.insert(structural_change_requests).values({
              garment_id: id,
              raw_feedback: g.structural_feedback,
              structural_requests: parsed.structural_requests || [],
              dependent_updates: parsed.dependent_updates || {},
              status: 'pending'
            });
          }
        } catch (e) {
          console.error("Gemini processing error:", e);
        }
      }

      await db.update(garments).set({
        buyer: g.buyer || '', season: g.season || '', sales: g.sales || '', cust_style_no: g.cust_style_no || '',
        y_style_no: g.y_style_no || '', garment_type: g.garment_type || '', washing: g.washing || '', fabric_raw: g.fabric_raw || '',
        gnw_weight: g.gnw_weight || '', fabric_yarn_count: g.fabric_yarn_count || '', fabric_material: g.fabric_material || '',
        fabric_construction: g.fabric_construction || '', sample_job_no: g.sample_job_no || '', color: g.color || '',
        size: g.size || '', print_datetime: g.print_datetime || '', description: g.description || '', remark_memo: g.remark_memo || '',
        structural_feedback: g.structural_feedback || '', content_notes: g.content_notes || '', hashtags: g.hashtags || '',
        ...immediate_updates // Overlay any immediate updates extracted by Gemini
      }).where(eq(garments.id, id));

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });`;

code = code.replace(putRegex, newPut);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with integrated PUT");
