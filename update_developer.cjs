const fs = require('fs');

const file = 'src/components/Developer.tsx';
const content = `import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw, Eye, Check } from 'lucide-react';
import { GarmentDetail } from './GarmentDetail';

export function Developer() {
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/garments');
      const data = await res.json();
      setGarments(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

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

  if (selectedGarment) {
    return (
      <GarmentDetail 
        garment={selectedGarment} 
        onClose={() => { 
          setSelectedGarment(null); 
          fetchData(); 
        }} 
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
            <Database className="w-6 h-6 text-neutral-700" />
            Developer Database Console
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">Direct access to the production Cloud SQL database & change requests.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="px-4 py-2 border border-neutral-300 rounded-lg flex items-center gap-2 hover:bg-neutral-50 text-sm font-medium">
            <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
            Refresh
          </button>
          <a href="/library.db" download className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-medium">
            <Download className="w-4 h-4" />
            Download .sqlite
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Buyer</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Structural Feedback</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Summaries</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {garments.map(g => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-mono text-neutral-900 font-bold">{g.id}</td>
                  <td className="px-6 py-4">{g.buyer || '-'}</td>
                  <td className="px-6 py-4 text-neutral-500 max-w-[240px] truncate" title={g.structural_feedback || g.reviewer_feedback || ''}>
                    {g.structural_feedback || g.reviewer_feedback || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">
                      {g.summaries?.length || 0} Versions
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={\`text-xs font-bold px-2.5 py-1 rounded-full \${
                      g.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }\`}>
                      {g.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedGarment(g)}
                      className="px-3.5 py-1.5 bg-neutral-900 text-white hover:bg-black rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> View & Approve
                    </button>
                  </td>
                </tr>
              ))}
              {garments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400">
                    No data in the database yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, content);
console.log("Updated Developer.tsx");
