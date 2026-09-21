const fs = require('fs');
let detail = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');

detail = detail.replace(
  '<span className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700">100% Cotton</span>\n              <span className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700">French Terry</span>\n              <span className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700">Bio Finished</span>',
  '{garment.materials?.map((m: string, i: number) => (\n                <span key={i} className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700">{m}</span>\n              ))}'
);

fs.writeFileSync('src/components/GarmentDetail.tsx', detail);
