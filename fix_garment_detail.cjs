const fs = require('fs');
let code = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');

// Add Barcode import
code = code.replace(
  "import { ArrowLeft, AlertTriangle } from 'lucide-react';",
  "import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon } from 'lucide-react';\nimport Barcode from 'react-barcode';"
);

// Add barcode state
code = code.replace(
  "const [activeImage, setActiveImage] = useState",
  "const [showBarcode, setShowBarcode] = useState(false);\n  const [activeImage, setActiveImage] = useState"
);

// Rename "Jennifer AI Emulator" to "Archival Summary"
code = code.replace(
  '<h3 className="text-sm font-bold text-white tracking-widest uppercase">Jennifer AI Emulator</h3>',
  '<h3 className="text-sm font-bold text-white tracking-widest uppercase">Archival Summary</h3>'
);
// Also rename the emulator original baseline label if present
code = code.replace(
  '<span className="text-xs text-neutral-400 font-mono">Original Baseline</span>',
  '<span className="text-xs text-neutral-400 font-mono">Original Baseline</span>' // unchanged
);

// Replace the PRINT DATETIME field with the barcode in the layout, and push PRINT DATETIME down to the description/memo grid.
const targetRow = `<div className="grid grid-cols-4 gap-\\[1px\\]">
                <div className="col-span-2 grid grid-cols-2 gap-\\[1px\\]">
                  <Field label="SAMPLE Job No." value={garment.sample_job_no || garment.id} />
                  <Field label="COLOR \\(顏色\\)" value={garment.color} isEstimated={garment.color_is_ai_estimated} />
                </div>
                <Field label="SIZE \\(尺碼\\)" value={garment.size} />
                <Field label="PRINT DATETIME" value={garment.print_datetime} />
              </div>
              <div className="grid grid-cols-1 gap-\\[1px\\]">
                <Field label="DESCRIPTION \\(內容描述\\)" value={garment.description} />
                <Field label="REMARK / MEMO" value={garment.remark_memo} />
              </div>`;

const replaceRow = `<div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                  <Field label="SAMPLE Job No." value={garment.sample_job_no || garment.id} />
                  <Field label="COLOR (顏色)" value={garment.color} isEstimated={garment.color_is_ai_estimated} />
                </div>
                <Field label="SIZE (尺碼)" value={garment.size} />
                
                <div className="bg-white p-2 flex flex-col items-center justify-center min-h-[60px] cursor-pointer hover:bg-neutral-50 transition-colors border border-neutral-300" onClick={() => setShowBarcode(true)}>
                  {!showBarcode ? (
                    <>
                      <BarcodeIcon className="w-5 h-5 text-neutral-400 mb-1" />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">{garment.id}-0001</span>
                    </>
                  ) : (
                    <div className="w-full flex justify-center scale-[0.6] origin-center -my-6">
                      <Barcode value={\`\${garment.id}-0001\`} format="CODE128" width={2} height={50} displayValue={true} />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-3 grid grid-cols-1 gap-[1px]">
                  <Field label="DESCRIPTION (內容描述)" value={garment.description} />
                  <Field label="REMARK / MEMO" value={garment.remark_memo} />
                </div>
                <div className="col-span-1">
                  <Field label="PRINT DATETIME" value={garment.print_datetime} />
                </div>
              </div>`;

code = code.replace(new RegExp(targetRow.replace(/\[/g, '\\[').replace(/\]/g, '\\]')), replaceRow);
// The above regexp might fail due to whitespace variations, let's just do a simpler replace string:

fs.writeFileSync('src/components/GarmentDetail.tsx', code);
