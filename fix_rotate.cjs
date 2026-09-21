const fs = require('fs');

// Fix standalone script
let compress = fs.readFileSync('scripts/compressImages.js', 'utf8');
compress = compress.replace(/await sharp\(inputPath\)/g, "await sharp(inputPath)\n        .rotate() // Auto-orient based on EXIF metadata before stripping");
fs.writeFileSync('scripts/compressImages.js', compress);

// Fix server endpoint
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/await sharp\(req\.file\.buffer\)/g, "await sharp(req.file.buffer)\n        .rotate() // Auto-orient based on EXIF metadata");
fs.writeFileSync('server.ts', server);
