import fs from 'fs';
import path from 'path';
import { db } from './src/db/index.ts';
import { images } from './src/db/schema.ts';

async function run() {
  const publicDir = path.join(process.cwd(), 'public');
  const rawDir = path.join(publicDir, 'images');
  
  const allImages = await db.select().from(images);
  const dbFilenames = new Set(allImages.map(i => i.filename));

  const rawFiles = fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : [];
  
  const missingInDb = rawFiles.filter(f => f.endsWith('.jpg') && !dbFilenames.has(f));
  
  console.log('Files on disk missing in DB:', missingInDb);
  process.exit(0);
}
run().catch(console.error);
