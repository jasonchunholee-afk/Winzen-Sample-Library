const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');
review = review.replace(/\/images_compressed\/\$\{id\} \(F\)_thumb\.jpg/g, '/images_thumb/${id} (F).jpg');
review = review.replace(/\/images_compressed\/\$\{id\} \(F\)_ai\.jpg/g, '/images_ai/${id} (F).jpg');
review = review.replace(/\/images_compressed\/\$\{id\} \(B\)_thumb\.jpg/g, '/images_thumb/${id} (B).jpg');
review = review.replace(/\/images_compressed\/\$\{id\} \(B\)_ai\.jpg/g, '/images_ai/${id} (B).jpg');
review = review.replace(/\/images_compressed\/\$\{id\}_thumb\.jpg/g, '/images_thumb/${id}.jpg');
review = review.replace(/\/images_compressed\/\$\{id\}_ai\.jpg/g, '/images_ai/${id}.jpg');
review = review.replace(/images_compressed/g, 'images_thumb'); // catch-all for error handler fallback check
fs.writeFileSync('src/components/Review.tsx', review);

let detail = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');
detail = detail.replace(/images_compressed/g, 'images_thumb');
detail = detail.replace(/_thumb/g, '');
detail = detail.replace(/_ai/g, '');
fs.writeFileSync('src/components/GarmentDetail.tsx', detail);

let compress = fs.readFileSync('scripts/compressImages.js', 'utf8');
compress = compress.replace(/const COMPRESSED_DIR = path.join\(PUBLIC_DIR, 'images_compressed'\);/g, 
  "const THUMB_DIR = path.join(PUBLIC_DIR, 'images_thumb');\nconst AI_DIR = path.join(PUBLIC_DIR, 'images_ai');");
compress = compress.replace(/await ensureDir\(COMPRESSED_DIR\);/g, "await ensureDir(THUMB_DIR);\n  await ensureDir(AI_DIR);");
compress = compress.replace(/const thumbPath = path\.join\(COMPRESSED_DIR, `\$\{parsed\.name\}_thumb\$\{parsed\.ext\}`\);/g, 
  "const thumbPath = path.join(THUMB_DIR, file);");
compress = compress.replace(/const aiPath = path\.join\(COMPRESSED_DIR, `\$\{parsed\.name\}_ai\$\{parsed\.ext\}`\);/g, 
  "const aiPath = path.join(AI_DIR, file);");
fs.writeFileSync('scripts/compressImages.js', compress);
