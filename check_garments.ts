import { db } from './src/db/index.ts';
import { garments, summaries, structural_change_requests } from './src/db/schema.ts';

async function check() {
  const allGarments = await db.select().from(garments);
  console.log("Total garments:", allGarments.length);
  for (const g of allGarments) {
    console.log(`- Garment ${g.id}: status=${g.status}, buyer=${g.buyer}, type=${g.garment_type}, hashtags=${g.hashtags}`);
  }

  const allSummaries = await db.select().from(summaries);
  console.log("\nTotal summaries:", allSummaries.length);
  for (const s of allSummaries) {
    console.log(`- Summary for ${s.garment_id}: ${s.summary_text?.slice(0, 80)}...`);
  }

  const requests = await db.select().from(structural_change_requests);
  console.log("\nTotal structural_change_requests:", requests.length);
  for (const r of requests) {
    console.log(`- Request ${r.id} for ${r.garment_id}: status=${r.status}, raw=${r.raw_feedback?.slice(0, 60)}...`);
  }
}
check();
