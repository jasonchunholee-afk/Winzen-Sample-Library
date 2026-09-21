const fs = require('fs');
let code = fs.readFileSync('src/components/Developer.tsx', 'utf8');
code = code.replace(/className=\{\\\`w-4 h-4 \\\$\\{loading \? 'animate-spin' : ''\\}\\\`\}/, 'className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}');
fs.writeFileSync('src/components/Developer.tsx', code);
