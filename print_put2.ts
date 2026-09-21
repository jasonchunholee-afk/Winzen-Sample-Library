import fs from 'fs';
const server = fs.readFileSync('server.ts', 'utf8');
const idx = server.indexOf('await db.insert(structural_change_requests)');
console.log(server.substring(idx, idx + 1500));
