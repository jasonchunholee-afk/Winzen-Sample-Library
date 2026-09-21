const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/structural_requests: parsed\.structural_requests \|\| \[\],/g, 'structural_requests: JSON.stringify(parsed.structural_requests || []),');
code = code.replace(/dependent_updates: parsed\.dependent_updates \|\| \{\},/g, 'dependent_updates: JSON.stringify(parsed.dependent_updates || {}),');
fs.writeFileSync('server.ts', code);
