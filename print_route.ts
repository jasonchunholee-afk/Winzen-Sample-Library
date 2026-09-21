import fs from 'fs';
const server = fs.readFileSync('server.ts', 'utf8');

function printBlock(startPattern: string, length = 1500) {
  const idx = server.indexOf(startPattern);
  if (idx !== -1) {
    console.log(`=== BLOCK ${startPattern} ===`);
    console.log(server.substring(idx, idx + length));
  } else {
    console.log(`Not found: ${startPattern}`);
  }
}

printBlock('app.post("/api/garments/:id/approve"');
printBlock('app.put("/api/garments/:id"');
printBlock('app.post("/api/garments/:id/process-feedback"');
