import { db } from './src/db/index.js';
import { warehouse_locations } from './src/db/schema.js';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const existing = await db.select({ count: sql`count(*)` }).from(warehouse_locations);
    console.log(existing);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
