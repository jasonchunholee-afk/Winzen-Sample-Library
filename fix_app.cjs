const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "import { Review } from './components/Review';",
  "import { Review } from './components/Review';\nimport { Samples } from './components/Samples';"
);

app = app.replace(
  "{view === 'samples' && <div className=\"p-12 text-center text-neutral-500 text-lg\">Samples Interface (In Progress)</div>}",
  "{view === 'samples' && <Samples />}"
);

fs.writeFileSync('src/App.tsx', app);
