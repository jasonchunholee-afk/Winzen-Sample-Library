const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /structural_feedback: g\.structural_feedback \|\| '',/,
  "structural_feedback: '', // Cleared after processing"
);
fs.writeFileSync('server.ts', code);
