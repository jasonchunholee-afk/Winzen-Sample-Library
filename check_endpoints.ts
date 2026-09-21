import fs from 'fs';
const server = fs.readFileSync('server.ts', 'utf8');

const endpoints = server.match(/app\.(get|post|put|patch|delete)\([^)]+\)/g);
console.log("Registered endpoints:");
console.log(endpoints?.join('\n'));
