const fs = require('fs');

let content = fs.readFileSync('server/routes/fgdRoutes.ts', 'utf-8');

// Add imports for db and schema if missing
if (!content.includes('import { db }')) {
  content = content.replace("import express from 'express';", "import express from 'express';\nimport { db } from '../../src/db/index.ts';\nimport { fgd_observations } from '../../src/db/schema.ts';");
}

// Replace POST /merchandiser/observations
content = content.replace(/router\.post\("\/merchandiser\/observations", async \(req, res\) => \{[\s\S]*?res\.status\(200\)\.json\(\{ success: true, observation: newObs, total_queued: observations\.length \}\);\n    \} catch \(err\) \{/g,
`router.post("/merchandiser/observations", async (req, res) => {
    try {
      const { userComment, garmentId, existingRule, diffsSummary } = req.body;
      
      const newObs = {
        id: 'obs_' + Date.now(),
        item_code: garmentId || 'GENERAL',
        observation_text: userComment,
        submitted_by: 'Jennifer',
        timestamp: new Date()
      };
      
      await db.insert(fgd_observations).values(newObs);
      
      const allRows = await db.select().from(fgd_observations);
      
      res.status(200).json({ success: true, observation: newObs, total_queued: allRows.length });
    } catch (err) {`);

// Replace GET /merchandiser/observations
content = content.replace(/router\.get\("\/merchandiser\/observations", async \(req, res\) => \{[\s\S]*?res\.status\(200\)\.json\(\{ observations: obs \}\);\n    \} catch \(err\) \{/g,
`router.get("/merchandiser/observations", async (req, res) => {
    try {
      const obsRows = await db.select().from(fgd_observations);
      
      const obs = obsRows.map(r => ({
        id: r.id,
        garmentId: r.item_code,
        userComment: r.observation_text,
        timestamp: r.timestamp?.toISOString() || new Date().toISOString()
      }));
      
      res.status(200).json({ observations: obs });
    } catch (err) {`);

// Now we need to remove the obsFile definitions and old logic.
// The above replaces already removed the obsFile logic for those specific route blocks since they were fully replaced.

fs.writeFileSync('server/routes/fgdRoutes.ts', content);
