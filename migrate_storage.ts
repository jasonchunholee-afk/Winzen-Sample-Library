import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from './src/db/index.ts';
import { images } from './src/db/schema.ts';
import { eq, notLike } from 'drizzle-orm';

async function migrate() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const storage = getStorage(app);

  const localImages = await db.select().from(images).where(notLike(images.filename, 'http%'));
  console.log(`Found ${localImages.length} local images to migrate.`);
  
  const publicDir = path.join(process.cwd(), 'public');
  
  for (const img of localImages) {
    if (!img.filename) continue;
    const rawPath = path.join(publicDir, 'images', img.filename);
    if (fs.existsSync(rawPath)) {
      try {
        console.log(`Uploading ${img.filename}...`);
        const buffer = fs.readFileSync(rawPath);
        const uint8array = new Uint8Array(buffer);
        
        const storageRef = ref(storage, `images/${img.filename}`);
        await uploadBytes(storageRef, uint8array, { contentType: 'image/jpeg' });
        const downloadURL = await getDownloadURL(storageRef);
        
        await db.update(images).set({ filename: downloadURL }).where(eq(images.id, img.id));
        console.log(`Success: ${img.filename} -> ${downloadURL}`);
      } catch (err) {
        console.error(`Error uploading ${img.filename}:`, err);
      }
    } else {
      console.warn(`File not found: ${rawPath}`);
    }
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
