import fs from 'fs';
import path from 'path';
import { db } from './src/db/index.ts';
import { garments, images } from './src/db/schema.ts';

async function audit() {
  const allGarments = await db.select().from(garments);
  const allImages = await db.select().from(images);

  const imagesByGarment = new Map();
  allImages.forEach(img => {
    if (!imagesByGarment.has(img.garment_id)) {
      imagesByGarment.set(img.garment_id, []);
    }
    imagesByGarment.get(img.garment_id).push(img);
  });

  const missing = [];
  for (const g of allGarments) {
    const imgs = imagesByGarment.get(g.id) || [];
    const roles = imgs.map(i => i.role);
    const missingRoles = [];
    if (!roles.includes('Front')) missingRoles.push('Front');
    if (!roles.includes('Back')) missingRoles.push('Back');
    if (!roles.includes('Label')) missingRoles.push('Label');

    if (missingRoles.length > 0) {
      missing.push({ id: g.id, missing: missingRoles });
    }
  }

  console.log('--- AUDIT REPORT ---');
  console.log(`Garments missing images: ${missing.length}`);
  missing.forEach(m => console.log(`Garment: ${m.id} - Missing: ${m.missing.join(', ')}`));

  const publicDir = path.join(process.cwd(), 'public');
  const thumbDir = path.join(publicDir, 'images_thumb');
  const rawDir = path.join(publicDir, 'images');

  const diskThumbs = fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir) : [];
  const diskRaws = fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : [];

  console.log(`\nDisk Thumbs: ${diskThumbs.length}, Disk Raws: ${diskRaws.length}`);

  console.log('\n--- 18S-1859-1 Check ---');
  const specificFiles = [...diskThumbs, ...diskRaws].filter(f => f.includes('18S-1859-1'));
  console.log(`Files found on disk for 18S-1859-1:`, [...new Set(specificFiles)]);

  process.exit(0);
}

audit().catch(console.error);
