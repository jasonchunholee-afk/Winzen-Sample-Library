import fs from 'fs';
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace('import { eq, desc } from "drizzle-orm";', 'import { eq, desc, and } from "drizzle-orm";');
fs.writeFileSync('server.ts', server);
console.log("Updated import in server.ts");
