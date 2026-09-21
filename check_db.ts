import { db } from './src/db/index.ts';
import { images } from './src/db/schema.ts';

async function run() {
  const res = await db.select({
    filename: images.filename,
    thumb_len: images.thumb_base64
  }).from(images);
  
  res.forEach(r => {
    console.log(`Image: ${r.filename}, Thumb length: ${r.thumb_len ? r.thumb_len.length : 0}`);
  });
  
  process.exit(0);
}
run().catch(console.error);
