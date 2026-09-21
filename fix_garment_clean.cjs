const fs = require('fs');

const code = `import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon } from 'lucide-react';
import Barcode from 'react-barcode';

interface GarmentDetailProps {
  garment: any;
  onClose: () => void;
}

export function GarmentDetail({ garment, onClose }: GarmentDetailProps) {
  const [showBarcode, setShowBarcode] = useState(false);
  const [activeImage, setActiveImage] = useState(garment.images?.[0]?.fullUrl || \`/images_ai/\${garment.id} (F).jpg\`);

  const Field = ({ label, value, isEstimated = false }: { label: string, value: string, isEstimated?: boolean }) => (
    <div className="border border-neutral-300 p-2 flex flex-col justify-center min-h-[60px] bg-white">
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{label}</span>
      <span className={\`text-sm font-medium \${isEstimated ? 'text-purple-700 italic' : 'text-neutral-900'} \${!value && 'text-neutral-300'}\`}>
        {value || (isEstimated ? 'Estimating...' : '---')}
      </span>
    </div>
  );

  return (
    <div className="bg-neutral-50 min-h-screen pb-12">
      {/* Header */}
      <div className="border-b border-neutral-200 px-8 py-4 flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors -ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-900">{garment.id}</h1>
              <span className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-md font-bold tracking-wide">
                PENDING APPROVAL
              </span>
            </div>
            <p className="text-sm text-neutral-500">{garment.buyer || garment.brand} • {garment.location || 'Vault — 0001'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Flag Issue
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm"
          >
            Approve & Save
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Images */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <img 
              src={activeImage} 
              alt={garment.id} 
              className="w-full h-auto object-contain bg-neutral-100 max-h-[70vh]"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('images/')) {
                  target.src = \`/images/\${garment.id} (F).jpg\`;
                }
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {garment.images?.map((img: any, i: number) => (
              <button 
                key={i}
                onClick={() => setActiveImage(img.fullUrl || img.url)}
                className={\`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all \${
                  activeImage === (img.fullUrl || img.url) ? 'border-blue-600 shadow-md ring-2 ring-blue-600/20' : 'border-transparent hover:border-neutral-300'
                }\`}
              >
                <img 
                  src={img.url} 
                  alt={\`\${garment.id} \${img.role}\`} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = img.fallbackUrl;
                  }}
                />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                  {img.role}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Extracted Data */}
        <div className="xl:col-span-7 space-y-8">
          
          {/* Label Reconstruction Table */}
          <section className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Structured Label Data</h2>
              <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-500"></div>
                 <span className="text-xs text-neutral-500 font-medium">AI Estimated Fields</span>
              </div>
            </div>

            <div className="border-[3px] border-neutral-900 bg-neutral-300 gap-[1px] grid">
              
              <div className="bg-white p-4 text-center border-b-[3px] border-neutral-900">
                <h3 className="font-serif text-2xl font-bold tracking-widest text-neutral-900">WINZEN APPAREL LIMITED</h3>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field label="BUYER (客人)" value={garment.buyer} />
                <Field label="SEASON (季節)" value={garment.season} />
                <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                  <Field label="SALES (營業員)" value={garment.sales} />
                  <Field label="CUST. STYLE NO." value={garment.cust_style_no} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field label="Y STYLE NO (款式編號)" value={garment.y_style_no} />
                <div className="col-span-3">
                  <Field label="GARMENT TYPE (樣辦類型)" value={garment.garment_type} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field label="WASHING (洗滌方式)" value={garment.washing} />
                <div className="col-span-2">
                  <Field label="RAW FABRIC TEXT" value={garment.fabric_raw} />
                </div>
                <Field label="G.N.W. (重量)" value={garment.gnw_weight} isEstimated={garment.gnw_is_ai_estimated} />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field label="YARN COUNT" value={garment.fabric_yarn_count} />
                <div className="col-span-2">
                  <Field label="MATERIAL" value={garment.fabric_material} />
                </div>
                <Field label="CONSTRUCTION" value={garment.fabric_construction} />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
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
                    <div className="w-full flex justify-center scale-[0.65] origin-center -my-6">
                      <Barcode value={\`\${garment.id}-0001\`} format="CODE128" width={2} height={40} displayValue={true} />
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
              </div>

            </div>
          </section>

          {/* Archival Summary section */}
          <section className="bg-neutral-900 rounded-2xl overflow-hidden shadow-lg border border-black">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">Archival Summary</h3>
              </div>
              <span className="text-xs text-neutral-400 font-mono">Original Baseline</span>
            </div>
            <div className="p-6">
              <p className="text-neutral-300 font-serif leading-relaxed whitespace-pre-wrap text-lg">
                {garment.jennifer_emulator_raw || "Waiting for baseline analysis..."}
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/GarmentDetail.tsx', code);
