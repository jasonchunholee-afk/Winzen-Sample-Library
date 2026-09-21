import fs from 'fs';
const server = fs.readFileSync('server.ts', 'utf8');
const idx = server.indexOf('app.post("/api/upload"');
console.log(server.substring(idx, idx + 1500));
