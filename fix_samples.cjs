const fs = require('fs');
let samples = fs.readFileSync('src/components/Samples.tsx', 'utf8');

const replaceStr = `  const Field = ({ label, fieldKey, options }: { label: string, fieldKey: keyof typeof filters, options?: string[] }) => {
    const uniqueOptions = options || Array.from(new Set(garments.map(g => g[fieldKey]).filter(Boolean)));
    return (
    <div className="border border-neutral-300 relative group bg-white flex flex-col">
      <div className="bg-neutral-100 text-[10px] uppercase font-bold px-3 py-1.5 text-neutral-500 border-b border-neutral-300">
        {label}
      </div>
      <div className="relative flex-1 flex">
        <select 
          value={filters[fieldKey]}
          onChange={(e) => handleFilterChange(fieldKey, e.target.value)}
          className="w-full p-2.5 text-sm focus:outline-none bg-white text-neutral-900 appearance-none font-medium cursor-pointer"
        >
          <option value="">Any...</option>
          {uniqueOptions.map((opt: any, i: number) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  )};`;

samples = samples.replace(
  /  const Field = \(\{ label, fieldKey, options \}: \{ label: string, fieldKey: keyof typeof filters, options\?: string\[\] \}\) => \([\s\S]*?\);\n/,
  replaceStr + '\n'
);

// We should also replace the container for the grid to look tighter like the label
samples = samples.replace(
  '          <div className="grid grid-cols-4 gap-0 border-2 border-neutral-300 bg-neutral-300">',
  '          <div className="grid grid-cols-4 gap-[1px] border-[3px] border-neutral-900 bg-neutral-900 shadow-sm">'
);

fs.writeFileSync('src/components/Samples.tsx', samples);
