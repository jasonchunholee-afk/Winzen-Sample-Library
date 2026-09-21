const fs = require('fs');
let code = fs.readFileSync('src/components/Developer.tsx', 'utf8');

code = code.replace(
  "if (username === 'Jason' && password === 'Jason') {",
  "if (username.trim().toLowerCase() === 'jason' && password.trim().toLowerCase() === 'jason') {"
);

fs.writeFileSync('src/components/Developer.tsx', code);
