const fs = require('fs');

const code = `import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Barcode as BarcodeIcon, MessageSquare, Star, Globe } from 'lucide-react';
import Barcode from 'react-barcode';

interface GarmentDetailProps {
  garment: any;
  onClose: () => void;
}

export function GarmentDetail({ garment, onClose }: GarmentDetailProps) {
  const [showBarcode, setShowBarcode] = useState(false);
  const [activeImage, setActiveImage] = useState(garment.images?.[0]?.fullUrl || \`/images_ai/\${garment.id} (F).jpg\`);
  
  // Content Edit State
  const [editData, setEditData] = useState({
    ...garment,
    structural_feedback: garment.structural_feedback || garment.reviewer_feedback || '',
    content_notes: garment.content_notes || '',
    hashtags: garment.hashtags || ''
  });

  const [saving, setSaving] = useState(false);
  const currentSummary = garment.summaries?.[0] || null;
  const [rating, setRating] = useState(currentSummary?.rating || 0);
  
  // Language Toggle State
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  const saveFeedback = async () => {
    setSaving(true);
    await fetch(\`/api/garments/\${garment.id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData)
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

  const handleFieldChange = (key: string, val: string) => {
    setEditData((prev: any) => ({ ...prev, [key]: val }));
  };

  const getLabel = (en: string, zh?: string) => {
    if (lang === 'zh' && zh) return zh;
    return en;
  };

  const Field = ({ labelEn, labelZh, fieldKey, isEstimated = false }: { labelEn: string, labelZh?: string, fieldKey: string, isEstimated?: boolean }) => {
    const val = editData[fieldKey] || '';
    return (
      <div className="border border-neutral-300 p-2 flex flex-col justify-center min-h-[60px] bg-white group focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{getLabel(labelEn, labelZh)}</span>
        <input 
          type="text"
          value={val}
          onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
          placeholder={isEstimated ? 'Estimating...' : '---'}
          className={\`w-full bg-transparent outline-none text-sm font-medium \${isEstimated ? 'text-purple-700 italic' : 'text-neutral-900'} \${!val && 'placeholder:text-neutral-300'}\`}
        />
      </div>
    );
  };

  return (
    <div className="bg-neutral-50 min-h-screen pb-12">
      {/* Header */}
      <div className="border-b border-neutral-200 px-8 py-4 flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { saveFeedback().then(onClose); }}
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
          <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 mr-2">
            <button 
              onClick={() => setLang('en')}
              className={\`px-3 py-1 rounded-md text-xs font-bold transition-colors \${lang === 'en' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}\`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('zh')}
              className={\`px-3 py-1 rounded-md text-xs font-bold transition-colors \${lang === 'zh' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}\`}
            >
              中文
            </button>
          </div>
          <button className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Flag Issue
          </button>
          <button 
            onClick={() => { saveFeedback().then(onClose); }}
            className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Approve & Save'}
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
                <h3 className="font-serif text-2xl font-bold tracking-widest text-neutral-900">WINZEN INTERNATIONAL LIMITED</h3>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="BUYER" labelZh="客人" fieldKey="buyer" />
                <Field labelEn="SEASON" labelZh="季節" fieldKey="season" />
                <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                  <Field labelEn="SALES" labelZh="營業員" fieldKey="sales" />
                  <Field labelEn="CUST. STYLE NO." labelZh="客款號" fieldKey="cust_style_no" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="STYLE NO" labelZh="款式編號" fieldKey="y_style_no" />
                <div className="col-span-3">
                  <Field labelEn="GARMENT TYPE" labelZh="樣辦類型" fieldKey="garment_type" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="WASHING" labelZh="洗滌方式" fieldKey="washing" />
                <div className="col-span-2">
                  <Field labelEn="RAW FABRIC TEXT" labelZh="布料原文" fieldKey="fabric_raw" />
                </div>
                <Field labelEn="G.N.W." labelZh="重量" fieldKey="gnw_weight" isEstimated={garment.gnw_is_ai_estimated} />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="YARN COUNT" labelZh="紗支" fieldKey="fabric_yarn_count" />
                <div className="col-span-2">
                  <Field labelEn="MATERIAL" labelZh="成份" fieldKey="fabric_material" />
                </div>
                <Field labelEn="CONSTRUCTION" labelZh="組織" fieldKey="fabric_construction" />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                  <Field labelEn="SAMPLE Job No." labelZh="辦單號" fieldKey="sample_job_no" />
                  <Field labelEn="COLOR" labelZh="顏色" fieldKey="color" isEstimated={garment.color_is_ai_estimated} />
                </div>
                <Field labelEn="SIZE" labelZh="尺碼" fieldKey="size" />
                
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
                  <Field labelEn="DESCRIPTION" labelZh="內容描述" fieldKey="description" />
                  <Field labelEn="REMARK / MEMO" labelZh="備註" fieldKey="remark_memo" />
                  <Field labelEn="HASHTAGS" labelZh="標籤" fieldKey="hashtags" />
                </div>
                <div className="col-span-1">
                  <Field labelEn="PRINT DATETIME" labelZh="列印時間" fieldKey="print_datetime" />
                </div>
              </div>

            </div>
          </section>

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

          {/* Structural Feedback section */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-neutral-100 bg-blue-50 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-blue-900 tracking-tight">Structural Feedback (Requires Dev Approval)</h3>
            </div>
            <div className="p-4">
              <textarea
                value={editData.structural_feedback}
                onChange={(e) => handleFieldChange('structural_feedback', e.target.value)}
                placeholder="Request systemic changes, new fields, or schema updates here..."
                className="w-full h-24 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-sm text-neutral-700 placeholder:text-neutral-400"
              />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/GarmentDetail.tsx', code);
