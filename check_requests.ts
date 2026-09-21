import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function check() {
  const res = await db.execute(sql`SELECT * FROM structural_change_requests`);
  console.log("PENDING REQUESTS:", JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
check();
