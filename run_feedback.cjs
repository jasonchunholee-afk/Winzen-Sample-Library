const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('public/library.db');

// Run the specific content updates for 11S-1906
try {
  // Add new columns if they don't exist
  try { db.exec("ALTER TABLE garments ADD COLUMN structural_feedback TEXT;"); } catch(e){}
  try { db.exec("ALTER TABLE garments ADD COLUMN content_notes TEXT;"); } catch(e){}
  try { db.exec("ALTER TABLE garments ADD COLUMN hashtags TEXT;"); } catch(e){}

  // Move existing feedback to structural_feedback for this garment
  db.prepare("UPDATE garments SET structural_feedback = reviewer_feedback, reviewer_feedback = '' WHERE id = '11S-1906'").run();

  // Apply the content feedback directly to the garment
  // #4 Single Jersey = 平紋
  // #5 S/SLV = short sleeve
  // #7 Dye process
  // #8 Hashtags
  db.prepare(`
    UPDATE garments 
    SET 
      fabric_material = REPLACE(fabric_material, 'Single Jersey', 'Single Jersey (平紋)'),
      garment_type = REPLACE(garment_type, 'S/SLV', 'Short Sleeve'),
      remark_memo = 'First reactive dye on garment, then tie dye also using reactive dye.',
      hashtags = '#garment_dye, #tie_dye'
    WHERE id = '11S-1906'
  `).run();

  console.log("Feedback applied successfully.");
} catch(e) {
  console.error("Error applying feedback:", e);
}
