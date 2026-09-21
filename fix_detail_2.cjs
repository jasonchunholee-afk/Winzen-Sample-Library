const fs = require('fs');
let detail = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');

// Fix activeImage fallback
detail = detail.replace(
  "target.src = garment.images[0].fallbackUrl || target.src.replace('images_thumb', 'images').replace('images_ai', 'images');", 
  "target.src = target.src.replace('images_thumb', 'images').replace('images_ai', 'images');"
);

// Fix grid images fallback
detail = detail.replace(
  "target.src = img.fallbackUrl || img.url.replace('images_thumb', 'images').replace('images_ai', 'images');", 
  "target.src = target.src.replace('images_thumb', 'images').replace('images_ai', 'images');"
);

fs.writeFileSync('src/components/GarmentDetail.tsx', detail);
