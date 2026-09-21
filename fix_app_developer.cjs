const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
app = app.replace(
  "import { Samples } from './components/Samples';",
  "import { Samples } from './components/Samples';\nimport { Developer } from './components/Developer';"
);

// Add Tab
app = app.replace(
  "<button onClick={() => setActiveTab('samples')}",
  "<button onClick={() => setActiveTab('developer')} className={`flex items-center gap-2 px-6 py-4 font-bold text-sm tracking-wide border-b-2 transition-colors ${activeTab === 'developer' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>Developer</button>\n          <button onClick={() => setActiveTab('samples')}"
);

// Add Render logic
app = app.replace(
  "{activeTab === 'samples' && <Samples />}",
  "{activeTab === 'samples' && <Samples />}\n      {activeTab === 'developer' && <Developer />}"
);

fs.writeFileSync('src/App.tsx', app);
