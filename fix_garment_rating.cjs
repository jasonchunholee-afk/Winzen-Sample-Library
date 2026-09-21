const fs = require('fs');

let code = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');

// Imports
code = code.replace(
  "import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon, MessageSquare } from 'lucide-react';",
  "import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon, MessageSquare, Star } from 'lucide-react';"
);

// State for rating
const injectState = `const [feedback, setFeedback] = useState(garment.reviewer_feedback || '');
  const [saving, setSaving] = useState(false);
  const currentSummary = garment.summaries?.[0] || null;
  const [rating, setRating] = useState(currentSummary?.rating || 0);

  const saveFeedback = async () => {
    setSaving(true);
    await fetch(\`/api/garments/\${garment.id}/feedback\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback })
    });
    setSaving(false);
  };

  const saveRating = async (val: number) => {
    setRating(val);
    if (currentSummary) {
      await fetch(\`/api/summaries/\${currentSummary.id}/rate\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: val })
      });
    }
  };
`;
code = code.replace("const [feedback, setFeedback] = useState(garment.reviewer_feedback || '');", injectState);

// Replace the Archival Summary section to include star ratings and versioning
const replaceArchival = `
          {/* Archival Summary section */}
          <section className="bg-neutral-900 rounded-2xl overflow-hidden shadow-lg border border-black mt-8">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">Archival Summary</h3>
                <span className="ml-2 bg-neutral-800 text-neutral-300 text-[10px] px-2 py-0.5 rounded-full border border-neutral-700">
                  Version {garment.summaries?.length || 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => saveRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={\`w-4 h-4 \${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-600'}\`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              <p className="text-neutral-300 font-serif leading-relaxed whitespace-pre-wrap text-lg">
                {currentSummary?.summary_text || garment.jennifer_emulator_raw || "Waiting for baseline analysis..."}
              </p>
            </div>
          </section>
`;

code = code.replace(
  /<section className="bg-neutral-900[\s\S]*?<\/section>/,
  replaceArchival.trim()
);

// Update Approve button to save feedback
code = code.replace(
  "onClick={onClose}",
  "onClick={() => { saveFeedback(); onClose(); }}"
); // only replacing the first instance will break or hit the wrong one. Let's do it precisely.

code = code.replace(
  `<button 
            onClick={onClose}
            className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm"
          >
            Approve & Save
          </button>`,
  `<button 
            onClick={() => { saveFeedback(); onClose(); }}
            className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Approve & Save'}
          </button>`
);

fs.writeFileSync('src/components/GarmentDetail.tsx', code);
