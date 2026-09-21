const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  '<div className="flex items-center gap-4 text-sm font-medium text-neutral-600">',
  `<div className="flex items-center gap-4 text-sm font-medium text-neutral-600">
          <a 
            href="/export.tar.gz" 
            download
            className="px-4 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Export All (.tar.gz)
          </a>`
);

fs.writeFileSync('src/App.tsx', app);
