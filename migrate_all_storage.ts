import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { db } from './src/db/index.ts';
import { images } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function migrate() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  
  const storage = getStorage(app);

  const publicDir = path.join(process.cwd(), 'public');
  const imagesDir = path.join(publicDir, 'images');
  
  if (!fs.existsSync(imagesDir)) {
    console.log("No images directory found.");
    process.exit(0);
  }
  
  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg'));
  console.log(`Found ${files.length} local images to migrate in public/images/`);
  
  for (const filename of files) {
    const rawPath = path.join(imagesDir, filename);
    try {
      console.log(`Uploading ${filename}...`);
      const buffer = fs.readFileSync(rawPath);
      const uint8array = new Uint8Array(buffer);
      
      const storageRef = ref(storage, `images/${filename}`);
      await uploadBytes(storageRef, uint8array, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(storageRef);
      
      // Determine garment_id and role from filename
      const parsed = filename.split('.');
      parsed.pop();
      const nameWithoutExt = parsed.join('.');
      
      let garmentId = nameWithoutExt.split(' ')[0] || 'UNKNOWN';
      let role = 'Front';
      if (nameWithoutExt.includes('(F)')) role = 'Front';
      else if (nameWithoutExt.includes('(B)')) role = 'Back';
      else if (nameWithoutExt.includes('(L)') || nameWithoutExt.endsWith(' Label')) role = 'Label';
      else if (nameWithoutExt.endsWith('001') || nameWithoutExt.endsWith('002')) {
        role = 'Label';
      }

      // Check if it's already in DB
      const existing = await db.select().from(images).where(eq(images.filename, downloadURL));
      if (existing.length === 0) {
        await db.insert(images).values({
          garment_id: garmentId,
          role: role,
          filename: downloadURL
        });
        console.log(`Success: ${filename} inserted -> ${downloadURL}`);
      } else {
        console.log(`Skipped: ${filename} already in DB`);
      }
      
    } catch (err) {
      console.error(`Error uploading ${filename}:`, err);
    }
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
