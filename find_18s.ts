import { db } from './src/db/index.ts';
import { images } from './src/db/schema.ts';
import { like } from 'drizzle-orm';

async function run() {
  const res = await db.select().from(images).where(like(images.filename, '%18S-1859-1%'));
  console.log(`Found ${res.length} rows for 18S-1859-1`);
  process.exit(0);
}
run().catch(console.error);
