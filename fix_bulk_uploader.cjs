const fs = require('fs');
let code = fs.readFileSync('src/components/BulkUploader.tsx', 'utf8');
code = code.replace(/Array\.from\(e\.target\.files\)\.filter\(\(f\) => f\.type/, "Array.from((e.target as HTMLInputElement).files || []).filter((f: File) => f.type");
fs.writeFileSync('src/components/BulkUploader.tsx', code);
