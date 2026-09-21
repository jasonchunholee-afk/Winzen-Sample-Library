const fs = require('fs');

let content = fs.readFileSync('server/routes/fgdRoutes.ts', 'utf-8');

// Inside /approve-ai-deduction, replace the obsFile write with PostgreSQL insert/update
content = content.replace(/\/\/ Persist full observation to data\/merchandiser_observations\.json[\s\S]*?fs\.writeFileSync\(obsFile, JSON\.stringify\(observations, null, 2\)\);/g,
`// Persist full observation to PostgreSQL
      const obsId = \`OBS-\${determinedCustomer.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-\${Date.now().toString(36).toUpperCase()}\`;
      const newObs = {
        id: obsId,
        item_code: garmentId || 'GENERAL',
        observation_text: userComment || rule.user_comment || finalInstruction,
        submitted_by: determinedCustomer || 'Jennifer',
        timestamp: new Date()
      };
      await db.insert(fgd_observations).values(newObs);`);

// Replace /observations endpoint
content = content.replace(/router\.get\("\/observations", \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: err\?\.message \|\| "Failed to load observations" \}\);\n    \}\n  \}\);/g,
`router.get("/observations", async (req, res) => {
    try {
      const rows = await db.select().from(fgd_observations);
      
      const obs = rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp?.toISOString() || new Date().toISOString(),
        customer: r.submitted_by,
        scope: 'global',
        garment_ids: [r.item_code],
        raw_commentary: r.observation_text,
        ai_deduction: 'Deducted pattern',
        status: 'approved',
        associated_rule_code: ''
      }));
      
      return res.json({ observations: obs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load observations" });
    }
  });`);

fs.writeFileSync('server/routes/fgdRoutes.ts', content);
