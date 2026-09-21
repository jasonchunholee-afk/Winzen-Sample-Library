import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const COMPRESSED_DIR = path.join(PUBLIC_DIR, 'images_compressed');

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function processImages() {
  await ensureDir(COMPRESSED_DIR);
  
  console.log(`Scanning ${IMAGES_DIR} for images...`);
  
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    
    if (imageFiles.length === 0) {
      console.log("No images found to compress yet. Make sure files are synced to the container.");
      return;
    }
    
    console.log(`Found ${imageFiles.length} images. Starting compression...`);
    
    for (const file of imageFiles) {
      const inputPath = path.join(IMAGES_DIR, file);
      const parsed = path.parse(file);
      
      // 1. Thumbnail (Grid display, super fast)
      // Max 400px width/height
      const thumbPath = path.join(COMPRESSED_DIR, `${parsed.name}_thumb${parsed.ext}`);
      await sharp(inputPath)
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toFile(thumbPath);
        
      // 2. AI Image Search / Inspection (High res but optimized)
      // Max 1024px width/height to save Gemini tokens but keep OCR readability
      const aiPath = path.join(COMPRESSED_DIR, `${parsed.name}_ai${parsed.ext}`);
      await sharp(inputPath)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(aiPath);
        
      console.log(`✅ Processed: ${file}`);
    }
    
    console.log("🎉 All images compressed successfully!");
    
  } catch (error) {
    console.error("Error processing images:", error);
  }
}

processImages();
