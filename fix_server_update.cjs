const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Ensure new columns in CREATE TABLE
serverCode = serverCode.replace(
  "reviewer_feedback TEXT,",
  "reviewer_feedback TEXT,\n      structural_feedback TEXT,\n      content_notes TEXT,\n      hashtags TEXT,"
);

// We need a route to handle full garment updates
const updateRoute = `
  app.put("/api/garments/:id", (req, res) => {
    const { id } = req.params;
    const g = req.body;
    
    db.prepare(\`
      UPDATE garments 
      SET 
        buyer = ?, season = ?, sales = ?, cust_style_no = ?, 
        y_style_no = ?, garment_type = ?, washing = ?, fabric_raw = ?, 
        gnw_weight = ?, fabric_yarn_count = ?, fabric_material = ?, 
        fabric_construction = ?, sample_job_no = ?, color = ?, 
        size = ?, print_datetime = ?, description = ?, remark_memo = ?,
        structural_feedback = ?, content_notes = ?, hashtags = ?
      WHERE id = ?
    \`).run(
      g.buyer || '', g.season || '', g.sales || '', g.cust_style_no || '',
      g.y_style_no || '', g.garment_type || '', g.washing || '', g.fabric_raw || '',
      g.gnw_weight || '', g.fabric_yarn_count || '', g.fabric_material || '',
      g.fabric_construction || '', g.sample_job_no || '', g.color || '',
      g.size || '', g.print_datetime || '', g.description || '', g.remark_memo || '',
      g.structural_feedback || '', g.content_notes || '', g.hashtags || '',
      id
    );
    
    res.json({ success: true });
  });

  app.post("/api/garments/:id/feedback"`;

serverCode = serverCode.replace('app.post("/api/garments/:id/feedback"', updateRoute);

fs.writeFileSync('server.ts', serverCode);
