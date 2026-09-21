import fs from 'fs';
import path from 'path';
import { db } from './src/db/index.ts';
import { garments, images, summaries } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function seed() {
  const rawData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'garments_data.json'), 'utf8'));
  
  for (const g of rawData) {
    try {
      const existing = await db.select().from(garments).where(eq(garments.id, g.id));
      if (existing.length === 0) {
        await db.insert(garments).values({
          id: g.id,
          brand: g.brand || '',
          buyer: g.buyer || '',
          season: g.season || '',
          sales: g.sales || '',
          cust_style_no: g.cust_style_no || '',
          y_style_no: g.y_style_no || '',
          garment_type: g.garment_type || '',
          washing: g.washing || '',
          fabric_raw: g.fabric_raw || '',
          gnw_weight: g.gnw_weight || '',
          gnw_is_ai_estimated: g.gnw_is_ai_estimated ? 1 : 0,
          fabric_yarn_count: g.fabric_yarn_count || '',
          fabric_material: g.fabric_material || '',
          fabric_construction: g.fabric_construction || '',
          sample_job_no: g.sample_job_no || '',
          color: g.color || '',
          color_is_ai_estimated: g.color_is_ai_estimated ? 1 : 0,
          size: g.size || '',
          print_datetime: g.print_datetime || '',
          description: g.description || '',
          remark_memo: g.remark_memo || '',
          location: 'Vault — 0001',
          status: 'pending'
        });
        
        if (g.jennifer_emulator_raw) {
          await db.insert(summaries).values({
            garment_id: g.id,
            summary_text: g.jennifer_emulator_raw
          });
        }
      }
    } catch (e) {
      console.error(`Error inserting ${g.id}:`, e);
    }
  }
  console.log("Seeding complete!");
  process.exit(0);
}
seed();
