import { useState, useRef, ChangeEvent } from 'react';
import { 
  X, Camera, Sparkles, AlertTriangle, CheckCircle2, 
  Loader2, Layers, ShieldCheck, Tag, Info, ArrowRight 
} from 'lucide-react';
import { WarehouseLocationItem, FullnessInspectionResult } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  location: WarehouseLocationItem | null;
  onInspectionApplied: () => Promise<void>;
}

export function WarehouseAiFullnessModal({ isOpen, onClose, location, onInspectionApplied }: Props) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<FullnessInspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !location) return null;

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setInspectionResult(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      const b64 = result.split(',')[1];
      setPhotoBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiInspection = async () => {
    if (!photoBase64) {
      setErrorMsg('Please upload or snap a photo of the stack on the shelf first.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);
      const res = await fetch('/api/warehouse/inspect-stack-fullness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationCode: location.location_code,
          imageBase64: photoBase64
        })
      });
      const data = await res.json();
      if (data.success && data.inspection) {
        setInspectionResult(data.inspection);
        await onInspectionApplied();
      } else {
        setErrorMsg(data.error || 'Failed to analyze stack fullness');
      }
    } catch (err: any) {
      console.error('Stack inspection error:', err);
      setErrorMsg('Network error while analyzing stack fullness.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualToggleFull = async (markFull: boolean) => {
    try {
      const res = await fetch(`/api/warehouse/locations/${location.location_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_full: markFull,
          notes: `Manually marked as ${markFull ? 'FULL' : 'AVAILABLE'} by operator`
        })
      });
      const data = await res.json();
      if (data.success) {
        await onInspectionApplied();
        onClose();
      }
    } catch (err) {
      console.error('Error toggling stack fullness:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Stack Fullness & OCR Inspector</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                  {location.location_code}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Determines capacity by visual fold thickness (e.g. 5 heavy jackets vs 15 polos)
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Stack Metadata Card */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Storage Target</span>
              <h4 className="text-sm font-bold text-neutral-900">{location.location_name}</h4>
              <p className="text-xs text-neutral-600 mt-0.5">
                Assigned: <span className="font-semibold text-neutral-800">{location.assigned_buyer || 'All Customers'}</span> • Type: <span className="font-semibold text-neutral-800">{location.assigned_type || 'Apparel'}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Current Count</span>
                <span className="font-bold text-neutral-900 font-mono text-sm">
                  {location.current_count} / {location.max_capacity_units} units
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-neutral-400 uppercase font-bold block">Status</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  location.is_full === 1 || location.fullness_level === 'FULL'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : location.fullness_level === 'NEAR_FULL'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {location.is_full === 1 ? 'FULL' : location.fullness_level}
                </span>
              </div>
            </div>
          </div>

          {/* Photo Capture / Upload Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>Snap or Upload Stack Photo</span>
              </label>
              <span className="text-[11px] text-neutral-500">
                Clear side/front view showing shelf clearance and garment fold layers
              </span>
            </div>

            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-neutral-300 bg-neutral-950 flex items-center justify-center max-h-72">
                <img 
                  src={photoPreview} 
                  alt="Stack inspection preview" 
                  className="max-h-72 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); setPhotoBase64(null); setInspectionResult(null); }}
                  className="absolute top-3 right-3 px-3 py-1 bg-black/80 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-neutral-50 hover:bg-indigo-50/20 space-y-2"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-xs text-neutral-600">
                  <span className="font-bold text-indigo-600">Click to snap photo</span> with phone camera or upload stack image
                </div>
                <p className="text-[11px] text-neutral-400">
                  Supports JPG, PNG, WebP • Phone camera supported via native capture
                </p>
              </div>
            )}

            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* AI Inspection Results View */}
          {inspectionResult && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    AI Visual Analysis Result
                  </h4>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  inspectionResult.isFull 
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : inspectionResult.fullnessLevel === 'NEAR_FULL'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {inspectionResult.isFull ? '🔴 STACK IS FULL' : `🟢 ${inspectionResult.fullnessLevel} (${inspectionResult.capacityPercentage}% Full)`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Estimated Fold Count</span>
                  <span className="text-base font-bold text-neutral-900 font-mono">
                    ~{inspectionResult.estimatedGarmentCount} garments
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Detected Garment Bulk</span>
                  <span className="text-base font-bold text-neutral-900">
                    {inspectionResult.detectedGarmentType}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-neutral-200">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Shelf Vertical Clearance</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          inspectionResult.capacityPercentage >= 90 ? 'bg-red-500' :
                          inspectionResult.capacityPercentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, inspectionResult.capacityPercentage)}%` }}
                      />
                    </div>
                    <span className="font-bold text-neutral-800 font-mono">{inspectionResult.capacityPercentage}%</span>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-white p-3.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">AI Visual Deduction</span>
                <p className="leading-relaxed">{inspectionResult.reasoning}</p>
              </div>

              {/* Detected OCR tags */}
              {inspectionResult.detectedOcrLabels.length > 0 && (
                <div className="bg-white p-3 rounded-lg border border-neutral-200 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-indigo-500" />
                    Detected OCR Text & Labels on Stack
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectionResult.detectedOcrLabels.map((lbl, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[11px] font-mono border border-neutral-200">
                        {lbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleManualToggleFull(location.is_full === 0)}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer underline"
            >
              Manual Override: Mark {location.is_full === 1 ? 'as Available' : 'as Full'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
            >
              Close
            </button>
            
            <button
              type="button"
              disabled={isAnalyzing || !photoBase64}
              onClick={handleRunAiInspection}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Analyzing Stack Fullness...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Run AI Fullness Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
