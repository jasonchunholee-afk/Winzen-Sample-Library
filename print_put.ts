import fs from 'fs';
const server = fs.readFileSync('server.ts', 'utf8');
const idx = server.indexOf('app.put("/api/garments/:id"');
console.log(server.substring(idx, idx + 2500));
