import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf8');

const pendingEndpoints = `
  // --- PENDING CHANGES & ACTIVATION API ---
  app.get("/api/pending-changes", async (req, res) => {
    try {
      const pending = await db.select().from(structural_change_requests)
        .where(eq(structural_change_requests.status, 'pending'))
        .orderBy(desc(structural_change_requests.created_at));
      
      const allGarments = await db.select().from(garments);
      const enriched = pending.map(p => {
        const g = allGarments.find(item => item.id === p.garment_id);
        let parsedFieldChanges = {};
        try {
          parsedFieldChanges = JSON.parse(p.field_changes || '{}');
        } catch {}
        let parsedStructural = [];
        try {
          parsedStructural = JSON.parse(p.structural_requests || '[]');
        } catch {}
        return {
          ...p,
          garment: g || null,
          parsedFieldChanges,
          parsedStructural
        };
      });
      res.json(enriched);
    } catch (err: any) {
      console.error("Error fetching pending changes:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pending-changes", async (req, res) => {
    try {
      const { garment_id, raw_feedback, field_changes, structural_requests, dependent_updates } = req.body;
      const newReq = await db.insert(structural_change_requests).values({
        garment_id,
        raw_feedback: raw_feedback || '',
        field_changes: typeof field_changes === 'object' ? JSON.stringify(field_changes) : (field_changes || '{}'),
        structural_requests: typeof structural_requests === 'object' ? JSON.stringify(structural_requests) : (structural_requests || '[]'),
        dependent_updates: typeof dependent_updates === 'object' ? JSON.stringify(dependent_updates) : (dependent_updates || '{}'),
        status: 'pending'
      }).returning();

      await db.update(garments).set({ status: 'Pending Approval' }).where(eq(garments.id, garment_id));
      res.json(newReq[0]);
    } catch (err: any) {
      console.error("Error staging pending change:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Activate pending changes with exact syntax "Apply Approved Changes"
  app.post("/api/changes/apply-approved", async (req, res) => {
    try {
      const { command, garment_id } = req.body;
      if (!command || command.trim().toLowerCase() !== "apply approved changes") {
        return res.status(400).json({ 
          error: "Invalid activation command. You must provide the exact syntax: 'Apply Approved Changes'" 
        });
      }

      // Fetch pending requests
      const pendingList = await db.select().from(structural_change_requests)
        .where(
          garment_id 
            ? and(eq(structural_change_requests.status, 'pending'), eq(structural_change_requests.garment_id, garment_id))
            : eq(structural_change_requests.status, 'pending')
        );

      if (pendingList.length === 0) {
        // If no formal pending requests, check if garment_id is provided to approve directly
        if (garment_id) {
          await db.update(garments).set({ status: 'Approved' }).where(eq(garments.id, garment_id));
          return res.json({ success: true, count: 1, message: "Garment approved directly." });
        }
        return res.json({ success: true, count: 0, message: "No pending changes to apply." });
      }

      // Load active rules and abbreviations for archival summary regeneration
      const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
      const rulesText = activeRules.map(r => \`[\${r.rule_code}] \${r.rule_title}: \${r.rule_instruction}\`).join('\\n');

      let appliedCount = 0;
      for (const p of pendingList) {
        let fieldChanges: any = {};
        try {
          fieldChanges = JSON.parse(p.field_changes || '{}');
        } catch {}
        let depUpdates: any = {};
        try {
          depUpdates = JSON.parse(p.dependent_updates || '{}');
        } catch {}

        const mergedUpdates: any = {
          ...fieldChanges,
          ...depUpdates,
          status: 'Approved',
          structural_feedback: ''
        };

        if (Object.keys(mergedUpdates).length > 0) {
          await db.update(garments).set(mergedUpdates).where(eq(garments.id, p.garment_id));
        }

        // Generate updated Archival Summary via Gemini
        const gList = await db.select().from(garments).where(eq(garments.id, p.garment_id));
        const updatedG = gList[0];
        if (updatedG && process.env.GEMINI_API_KEY) {
          try {
            const ai = new GoogleGenAI({ 
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });
            const summaryPrompt = \`Generate a precise, professional Archival Summary for this approved garment in the Winzen archive:
Garment ID: \${updatedG.id}
Buyer: \${updatedG.buyer}
Garment Type: \${updatedG.garment_type}
Season: \${updatedG.season}
Style No: \${updatedG.cust_style_no} / \${updatedG.y_style_no}
Fabric: \${updatedG.fabric_raw}
Material: \${updatedG.fabric_material}
Weight: \${updatedG.gnw_weight}
Yarn Count: \${updatedG.fabric_yarn_count}
Construction: \${updatedG.fabric_construction}
Color: \${updatedG.color}
Size: \${updatedG.size}
Visible Hashtags: \${updatedG.hashtags}
Invisible / Alternative Search Hashtags: \${updatedG.invisible_hashtags}
Approved Changes Applied: \${p.raw_feedback || 'User structural approval'}

RULES ENFORCED:
\${rulesText}

Write 2-4 authoritative, highly detailed sentences summarizing this garment's construction, technical fabric features, aesthetic attributes, and taxonomy classification. Do NOT output markdown headers, just the pure archival paragraph.\`;

            const summaryRes = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: summaryPrompt
            });

            if (summaryRes && summaryRes.text) {
              await db.insert(summaries).values({
                garment_id: p.garment_id,
                summary_text: summaryRes.text.trim(),
                rating: 5
              });
            }
          } catch (sumErr) {
            console.error("Error regenerating archival summary:", sumErr);
          }
        }

        // Mark request as applied
        await db.update(structural_change_requests).set({
          status: 'applied',
          applied_at: new Date()
        }).where(eq(structural_change_requests.id, p.id));

        appliedCount++;
      }

      res.json({ success: true, count: appliedCount, message: \`Successfully applied \${appliedCount} approved changes and updated archival summaries.\` });
    } catch (err: any) {
      console.error("Error applying approved changes:", err);
      res.status(500).json({ error: err.message });
    }
  });
`;

if (!serverCode.includes('/api/changes/apply-approved')) {
  serverCode = serverCode.replace('// --- LABELING RULES API ---', pendingEndpoints + '\n  // --- LABELING RULES API ---');
  fs.writeFileSync('server.ts', serverCode);
  console.log("Updated server.ts with Pending Changes and Apply Approved Changes endpoints");
} else {
  console.log("Already exists in server.ts");
}
