const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const approveEndpoint = `  app.post("/api/garments/:id/approve", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE garments SET status = 'Approved' WHERE id = ?").run(id);
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- API ENDPOINTS ---`;
serverCode = serverCode.replace("  // --- API ENDPOINTS ---", approveEndpoint);
fs.writeFileSync('server.ts', serverCode);

let devCode = fs.readFileSync('src/components/Developer.tsx', 'utf8');

const importReplacement = `import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw, Eye, Check } from 'lucide-react';`;
devCode = devCode.replace(/import \{ useState, useEffect \} from 'react';\nimport \{ Database, Download, RefreshCw \} from 'lucide-react';/, importReplacement);

const devState = `  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedGarment, setSelectedGarment] = useState<any>(null);`;
devCode = devCode.replace(/  const \[garments, setGarments\] = useState<any\[\]>\(\[\]\);\n  const \[loading, setLoading\] = useState\(false\);/, devState);

const devApprove = `
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(\`/api/garments/\${id}/approve\`, { method: 'POST' });
      if (res.ok) {
        setSelectedGarment(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (`;
devCode = devCode.replace(/  return \(/, devApprove);

const devModal = `      </div>

      {selectedGarment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Structural Feedback - {selectedGarment.id}</h3>
            <div className="bg-neutral-50 p-4 rounded-lg text-sm text-neutral-700 mb-6 whitespace-pre-wrap">
              {selectedGarment.structural_feedback || 'No feedback provided.'}
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSelectedGarment(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleApprove(selectedGarment.id)}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">`;
devCode = devCode.replace(/      <\/div>\n\n      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">/, devModal);


const tableRows = `<th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Summaries</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Actions</th>
              </tr>`;
devCode = devCode.replace(/<th className="px-6 py-3 font-bold uppercase tracking-wider text-\[10px\]">Summaries<\/th>\n                <th className="px-6 py-3 font-bold uppercase tracking-wider text-\[10px\]">Created At<\/th>\n              <\/tr>/, tableRows);


const rowTds = `<td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">
                      {g.summaries?.length || 0} Versions
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-neutral-600">{g.status || 'Pending'}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedGarment(g)}
                      className="px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-md text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View & Approve
                    </button>
                  </td>
                </tr>`;
devCode = devCode.replace(/<td className="px-6 py-4">\n                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">\n                      \{g\.summaries\?\.length \|\| 0\} Versions\n                    <\/span>\n                  <\/td>\n                  <td className="px-6 py-4 text-neutral-400 font-mono text-xs">\{g\.created_at \|\| 'Legacy JSON'\}<\/td>\n                <\/tr>/, rowTds);

const colSpan = `<td colSpan={6} className="px-6 py-12 text-center text-neutral-400">`;
devCode = devCode.replace(/<td colSpan=\{5\} className="px-6 py-12 text-center text-neutral-400">/, colSpan);

fs.writeFileSync('src/components/Developer.tsx', devCode);
