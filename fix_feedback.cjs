const fs = require('fs');
let code = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');

// 1. Add MessageSquare to imports
code = code.replace(
  "import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon } from 'lucide-react';",
  "import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon, MessageSquare } from 'lucide-react';"
);

// 2. Add feedback state
code = code.replace(
  "const [activeImage, setActiveImage] = useState(garment.images?.[0]?.fullUrl || `/images_ai/${garment.id} (F).jpg`);",
  "const [activeImage, setActiveImage] = useState(garment.images?.[0]?.fullUrl || `/images_ai/${garment.id} (F).jpg`);\n  const [feedback, setFeedback] = useState(garment.reviewer_feedback || '');"
);

// 3. Inject the new Quality Control Feedback section below the Archival Summary
const newSection = `
          {/* Quality Control Feedback section */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-neutral-500" />
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Reviewer Notes & Feedback</h3>
            </div>
            <div className="p-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Enter corrections, missing details, or feedback on the AI extraction..."
                className="w-full h-32 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-sm text-neutral-700 placeholder:text-neutral-400"
              />
            </div>
          </section>
`;

code = code.replace(
  "          </section>\n\n        </div>",
  "          </section>\n" + newSection + "\n        </div>"
);

fs.writeFileSync('src/components/GarmentDetail.tsx', code);
