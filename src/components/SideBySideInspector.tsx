import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, RotateCw, RefreshCw, CheckCircle, ArrowRight,
  Sparkles, X, Layers, AlertTriangle, Hash, Plus, Check, Eye
} from 'lucide-react';

interface SideBySideInspectorProps {
  garment: any;
  editData: any;
  handleFieldChange: (fieldKey: string, value: any) => void;
  lang: 'en' | 'zh';
  displayImages: any[];
  onRerunFgd: () => Promise<void>;
  rerunningFgd: boolean;
  onClose: () => void;
  onSavePending: () => Promise<void>;
  saving: boolean;
}

export function SideBySideInspector({
  garment,
  editData,
  handleFieldChange,
  lang,
  displayImages,
  onRerunFgd,
  rerunningFgd,
  onClose,
  onSavePending,
  saving
}: SideBySideInspectorProps) {
  // Find primary label image or first available
  const defaultLabelIndex = Math.max(0, displayImages.findIndex(img => 
    (img.role || '').toLowerCase().includes('label') || 
    (img.filename || '').endsWith('.jpg') && !img.filename?.includes('(F)') && !img.filename?.includes('(B)')
  ));

  const [selectedImgIndex, setSelectedImgIndex] = useState(defaultLabelIndex);
  const currentImg = displayImages[selectedImgIndex] || displayImages[0] || null;

  // 3-Tier Image Routing: Default to ai/ tier for OCR and analysis inspection, load raw/ on high-res zoom
  const [preferRawTier, setPreferRawTier] = useState(false);

  const sharpImageUrl = currentImg ? (
    preferRawTier
      ? (currentImg.rawUrl || currentImg.fallbackUrl || (currentImg.filename ? `/images/${currentImg.filename}` : null) || currentImg.url)
      : (currentImg.aiUrl || currentImg.fullUrl || (currentImg.filename ? `/images_ai/${currentImg.filename}` : null) || currentImg.url)
  ) : '';

  // Zoom and Pan State
  const [zoom, setZoom] = useState(1.25); // Default slightly zoomed for easy reading
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = 0.15;
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(3.5, Number((prev + zoomStep).toFixed(2))));
    } else {
      setZoom(prev => Math.max(0.75, Number((prev - zoomStep).toFixed(2))));
    }
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const getLabel = (en: string, zh?: string) => (lang === 'zh' && zh ? zh : en);

  // Hashtag adder state
  const [newTagInput, setNewTagInput] = useState('');
  const hashtagsList = (editData.hashtags || '')
    .split(',')
    .map((t: string) => t.trim())
    .filter(Boolean);

  const addHashtag = () => {
    if (!newTagInput.trim()) return;
    let tag = newTagInput.trim();
    if (!tag.startsWith('#')) tag = `#${tag}`;
    if (!hashtagsList.includes(tag)) {
      const updated = [...hashtagsList, tag].join(', ');
      handleFieldChange('hashtags', updated);
    }
    setNewTagInput('');
  };

  const removeHashtag = (tagToRemove: string) => {
    const updated = hashtagsList.filter((t: string) => t !== tagToRemove).join(', ');
    handleFieldChange('hashtags', updated);
  };

  return (
    <div className="bg-neutral-900 text-neutral-100 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden mb-8">
      {/* Top Inspection Workspace Toolbar */}
      <div className="bg-neutral-850 px-6 py-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Side-by-Side Physical Label Audit
              </h2>
              <span className="text-[11px] font-mono font-bold bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">
                {garment.id}
              </span>
              <span className="text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                Option C: Sharp 1024px AI Vision
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Audit the physical label against extracted FGD fields in real-time. Use zoom and pan controls on the left.
            </p>
          </div>
        </div>

        {/* Global Inspection Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRerunFgd}
            disabled={rerunningFgd}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            title="Re-run Zero-Omission vision extraction via Gemini on physical label"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunningFgd ? 'animate-spin' : ''}`} />
            <span>{rerunningFgd ? 'Re-running FGD...' : 'Re-run FGD'}</span>
          </button>

          <button
            type="button"
            onClick={onSavePending}
            disabled={saving}
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span>{saving ? 'Queueing...' : 'Queue Audited Specs'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer border border-neutral-700"
            title="Exit Side-by-Side view"
          >
            <X className="w-4 h-4" />
            <span>Exit Split View</span>
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[720px]">
        {/* LEFT PANE: Interactive High-Res Label Viewer */}
        <div className="xl:col-span-6 bg-neutral-950 border-r border-neutral-800 flex flex-col">
          {/* Label Shot Selector & Zoom Controls */}
          <div className="px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Shot selector pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1">
                Image:
              </span>
              {displayImages.map((img: any, idx: number) => {
                const isSelected = idx === selectedImgIndex;
                const isLabel = (img.role || '').toLowerCase().includes('label');
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedImgIndex(idx);
                      handleReset();
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : isLabel
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-purple-500/40'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    <span>{img.role || `Shot ${idx + 1}`}</span>
                    {isLabel && <span className="text-[9px] bg-purple-900/60 px-1 rounded">Label</span>}
                  </button>
                );
              })}
            </div>

            {/* Interactive Zoom Controls */}
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2 py-1 rounded-lg border border-neutral-700">
              <button
                type="button"
                onClick={() => setZoom(prev => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                className="p-1 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-[11px] font-bold text-neutral-200 min-w-[42px] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoom(prev => Math.min(3.5, Number((prev + 0.25).toFixed(2))))}
                className="p-1 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded ml-1"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] bg-neutral-700 hover:bg-neutral-600 px-1.5 py-0.5 rounded text-neutral-200 ml-1"
                title="Reset zoom & position"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() => setPreferRawTier(prev => !prev)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded ml-1 transition-colors ${
                  preferRawTier 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                }`}
                title={preferRawTier ? 'Using Raw Archive (Original Full Resolution)' : 'Using AI Tier (1024px OCR optimized). Click for Raw Archive.'}
              >
                {preferRawTier ? 'RAW TIER' : 'AI TIER'}
              </button>
            </div>
          </div>

          {/* Zoomable Image Canvas Viewport */}
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 relative overflow-hidden flex items-center justify-center min-h-[560px] bg-neutral-950 select-none ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {sharpImageUrl ? (
              <img
                src={sharpImageUrl}
                alt={`${garment.id} high resolution inspection view`}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                }}
                className="max-h-[85vh] max-w-[95%] object-contain pointer-events-none drop-shadow-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('images/')) {
                    target.src = currentImg?.fallbackUrl || `/images/${garment.id}.jpg`;
                  }
                }}
              />
            ) : (
              <div className="text-neutral-500 text-xs flex flex-col items-center">
                <AlertTriangle className="w-8 h-8 text-neutral-600 mb-2" />
                <span>No physical label image found for inspection</span>
              </div>
            )}

            {/* Zero-Omission Inspection Guidance Overlay */}
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
              <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-xl p-2.5 text-[11px] text-neutral-300 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-semibold text-white">Zero-Omission Inspection Target:</span>
                  <span className="text-neutral-400">
                    Verify Buyer, Brand Code (e.g. BMA), Sales/Merchandiser (e.g. Amy), Goods No., Style No., fiber % & handwritten text.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 ml-2 whitespace-nowrap">
                  Scroll wheel: Zoom | Drag: Pan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Extracted Structured FGD Form Fields */}
        <div className="xl:col-span-6 bg-white text-neutral-900 overflow-y-auto max-h-[85vh] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                Extracted Full Garment Description (FGD)
              </h3>
              <p className="text-xs text-neutral-500">
                Directly audit and edit extracted fields. Changes update the catalog specification in real-time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                Zero-Omission
              </span>
            </div>
          </div>

          {/* Structured Winzen Label Grid Table */}
          <div className="border-[3px] border-neutral-900 bg-neutral-300 gap-[1px] grid shadow-xs">
            <div className="bg-white p-3 text-center border-b-[3px] border-neutral-900">
              <h4 className="font-serif text-xl font-bold tracking-widest text-neutral-900">
                WINZEN INTERNATIONAL LIMITED
              </h4>
            </div>

            {/* Row 1: BUYER, BRAND CODE, SEASON, SALES, MERCHANDISER */}
            <div className="grid grid-cols-5 gap-[1px]">
              <InspectorField labelEn="BUYER" labelZh="客人" fieldKey="buyer" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="BRAND CODE" labelZh="品牌代碼" fieldKey="brand_code" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="SEASON" labelZh="季節" fieldKey="season" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="SALES" labelZh="營業員" fieldKey="sales" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="MERCHANDISER" labelZh="跟單員" fieldKey="merchandiser" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
            </div>

            {/* Row 2: STYLE NO, CUST STYLE NO, GOODS NO, GARMENT TYPE */}
            <div className="grid grid-cols-4 gap-[1px]">
              <InspectorField labelEn="STYLE NO" labelZh="款式編號" fieldKey="y_style_no" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="CUST. STYLE NO." labelZh="客款號" fieldKey="cust_style_no" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="GOODS NO." labelZh="訂單號/貨號" fieldKey="goods_no" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="GARMENT TYPE" labelZh="樣辦類型" fieldKey="garment_type" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
            </div>

            {/* Row 3: FABRIC MATERIAL & G.N.W. WEIGHT */}
            <div className="grid grid-cols-4 gap-[1px]">
              <div className="col-span-3">
                <InspectorField labelEn="BUYER FABRIC / MATERIAL" labelZh="布料成份" fieldKey="fabric_material" fallbackKey="fabric_raw" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              </div>
              <InspectorField labelEn="G.N.W." labelZh="重量" fieldKey="gnw_weight" editData={editData} handleFieldChange={handleFieldChange} lang={lang} isEstimated={garment.gnw_is_ai_estimated} />
            </div>

            {/* Row 4: WASHING, CONSTRUCTION, YARN COUNT */}
            <div className="grid grid-cols-4 gap-[1px]">
              <InspectorField labelEn="WASHING" labelZh="洗滌方式" fieldKey="washing" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <div className="col-span-2">
                <InspectorField labelEn="CONSTRUCTION" labelZh="織法組織" fieldKey="fabric_construction" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              </div>
              <InspectorField labelEn="YARN COUNT" labelZh="紗支" fieldKey="fabric_yarn_count" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
            </div>

            {/* Row 5: SAMPLE JOB NO, COLOR, SIZE */}
            <div className="grid grid-cols-4 gap-[1px]">
              <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                <InspectorField labelEn="SAMPLE Job No." labelZh="辦單號" fieldKey="sample_job_no" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
                <InspectorField labelEn="COLOR" labelZh="顏色" fieldKey="color" editData={editData} handleFieldChange={handleFieldChange} lang={lang} isEstimated={garment.color_is_ai_estimated} />
              </div>
              <InspectorField labelEn="SIZE" labelZh="尺碼" fieldKey="size" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <div className="bg-white p-2 flex flex-col items-center justify-center min-h-[50px] border border-neutral-300">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{garment.id}</span>
                <span className="text-[9px] text-neutral-400">Barcode Target</span>
              </div>
            </div>

            {/* Row 6: DESCRIPTION, REMARK/MEMO, HANDWRITTEN NOTES */}
            <div className="grid grid-cols-1 gap-[1px]">
              <InspectorField labelEn="DESCRIPTION" labelZh="內容描述" fieldKey="description" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="REMARK / MEMO" labelZh="備註" fieldKey="remark_memo" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
              <InspectorField labelEn="HANDWRITTEN NOTES" labelZh="手寫筆記 / 標籤註記" fieldKey="handwritten_notes" editData={editData} handleFieldChange={handleFieldChange} lang={lang} />
            </div>
          </div>

          {/* Hashtags Section */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-orange-500" />
                <span>Search Hashtags</span>
              </span>
              <span className="text-[10px] text-neutral-400">{hashtagsList.length} tags</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {hashtagsList.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-white border border-neutral-300 px-2 py-0.5 rounded-md text-xs font-medium text-neutral-800 shadow-2xs"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="hover:text-red-500 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHashtag();
                  }
                }}
                placeholder="Add custom hashtag..."
                className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addHashtag}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorField({
  labelEn,
  labelZh,
  fieldKey,
  fallbackKey,
  editData,
  handleFieldChange,
  lang,
  isEstimated = false
}: {
  labelEn: string;
  labelZh?: string;
  fieldKey: string;
  fallbackKey?: string;
  editData: any;
  handleFieldChange: (k: string, v: any) => void;
  lang: 'en' | 'zh';
  isEstimated?: boolean;
}) {
  const val = editData[fieldKey] || (fallbackKey ? editData[fallbackKey] : '') || '';

  return (
    <div className="border border-neutral-300 bg-white p-2 flex flex-col justify-center min-h-[52px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
          {lang === 'zh' && labelZh ? labelZh : labelEn}
        </span>
        {isEstimated && (
          <span className="text-[8px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1 rounded">
            AI Est
          </span>
        )}
      </div>
      <input
        type="text"
        value={val}
        onChange={(e) => {
          handleFieldChange(fieldKey, e.target.value);
          if (fallbackKey && editData[fallbackKey] !== undefined) {
            handleFieldChange(fallbackKey, e.target.value);
          }
        }}
        placeholder={isEstimated ? 'Estimating...' : '---'}
        className={`w-full bg-transparent outline-none text-xs font-medium text-neutral-900 ${
          isEstimated ? 'italic text-purple-800' : ''
        } ${!val && 'placeholder:text-neutral-300'}`}
      />
    </div>
  );
}
