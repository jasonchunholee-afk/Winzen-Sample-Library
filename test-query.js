import { db } from './src/db/index.js';
import { warehouse_locations } from './src/db/schema.js';
import { sql } from 'drizzle-orm';
async function run() {
  try {
    const existing = await db.select({ count: sql`count(*)` }).from(warehouse_locations);
    console.log(existing);
  } catch (err) {
    console.error(err);
  }
}
run();
