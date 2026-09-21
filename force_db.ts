import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS structural_change_requests (
      id SERIAL PRIMARY KEY,
      garment_id TEXT REFERENCES garments(id),
      raw_feedback TEXT,
      structural_requests JSONB,
      dependent_updates JSONB,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("Table created!");
  process.exit(0);
}
run();
