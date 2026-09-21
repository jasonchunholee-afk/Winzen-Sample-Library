import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';
async function test() {
  const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log(result);
  process.exit(0);
}
test();
