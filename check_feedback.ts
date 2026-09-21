import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function check() {
  const res = await db.execute(sql`SELECT id, structural_feedback, reviewer_feedback, status FROM garments WHERE structural_feedback != '' OR reviewer_feedback != '' LIMIT 10`);
  console.log("GARMENTS WITH FEEDBACK:", JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
check();
