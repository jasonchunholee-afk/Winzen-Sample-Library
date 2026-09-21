import { useState, useRef, ChangeEvent } from 'react';
import { 
  X, CheckCircle2, Camera, Upload, Layers, ArrowRight, 
  PackageCheck, Loader2, AlertCircle, Printer, Sparkles
} from 'lucide-react';
import { UnshelfedGarmentItem } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unshelfedItems: UnshelfedGarmentItem[];
  onBatchShelved: () => Promise<void>;
}

export function WarehouseBatchShelvingModal({ isOpen, onClose, unshelfedItems, onBatchShelved }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => unshelfedItems.slice(0, 20).map(i => i.id));
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [operator, setOperator] = useState('Chen');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentBatch = unshelfedItems.slice(0, 20);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllCurrent = () => {
    setSelectedIds(currentBatch.map(i => i.id));
  };

  const handlePhotoCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      const b64 = result.split(',')[1];
      setPhotoBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmShelved = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one garment to confirm shelving.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/warehouse/shelve-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: selectedIds,
          operator,
          photoEvidenceBase64: photoBase64,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitSuccess(`Batch ${data.batchNo} successfully shelved! ${data.shelvedCount} garments placed into assigned rolling cabinet spaces.`);
        await onBatchShelved();
        setTimeout(() => {
          setSubmitSuccess(null);
          onClose();
        }, 1800);
      } else {
        alert(data.error || 'Failed to confirm shelving batch');
      }
    } catch (err: any) {
      console.error('Error confirming shelving batch:', err);
      alert('Network error while confirming shelving batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Chen's Batch Shelving Manifest</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-neutral-950">
                  Current 20 Garments
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Move garments from Temporary Box/Bag into designated Rolling Cabinet spaces
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
          {submitSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3 my-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-emerald-900">Batch Shelving Confirmed!</h4>
              <p className="text-sm text-emerald-700 max-w-md mx-auto">{submitSuccess}</p>
            </div>
          ) : (
            <>
              {/* Operator Instructions & Action Bar */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Instructions for Chen</span>
                  <p className="text-xs text-neutral-700">
                    1. Review the assigned locations below • 2. Take a photo of the batch or shelf with your phone • 3. Place each garment in its numbered stack • 4. Click 'Confirm Shelved'.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={selectAllCurrent}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-lg cursor-pointer"
                  >
                    Select All ({currentBatch.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg flex items-center gap-1.5 bg-white cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                </div>
              </div>

              {/* Garment Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold px-1">
                  <span>Garments in Current Batch ({selectedIds.length} of {currentBatch.length} selected)</span>
                  <span>Target Assigned Space</span>
                </div>

                {currentBatch.length === 0 ? (
                  <div className="text-center py-10 bg-neutral-50 rounded-xl border border-dashed border-neutral-300 text-neutral-500 text-sm">
                    No unshelfed garments in the temporary container right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentBatch.map((item, idx) => {
                      const isSelected = selectedIds.includes(item.id);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-amber-50/50 border-amber-300 shadow-xs' 
                              : 'bg-white border-neutral-200 hover:border-neutral-300 opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                            />
                            
                            {item.thumb_url ? (
                              <img 
                                src={item.thumb_url} 
                                alt={item.id} 
                                className="w-12 h-12 rounded-lg object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 shrink-0 text-[10px]">
                                No img
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-neutral-900 truncate">
                                  {item.id}
                                </span>
                                <span className="text-[10px] font-semibold text-neutral-400">
                                  #{idx + 1}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 truncate">
                                {item.buyer || 'Unknown Customer'} • {item.garment_type || 'Apparel'}
                              </p>
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                {item.temp_container || 'Temp Box 1'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0">
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">Assigned Space</span>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 block font-mono">
                              {item.assigned_location || 'CAB1-SH1-STK1'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Photo Evidence & Verification (Phone upload) */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-neutral-800">Chen's Phone Photo Verification (Optional but Recommended)</span>
                  </div>
                  {photoPreview && (
                    <button 
                      type="button" 
                      onClick={() => { setPhotoPreview(null); setPhotoBase64(null); }}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {photoPreview ? (
                    <img 
                      src={photoPreview} 
                      alt="Verification Evidence" 
                      className="w-24 h-24 rounded-xl object-cover border border-neutral-300 shadow-xs"
                    />
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-48 h-20 rounded-xl border-2 border-dashed border-neutral-300 hover:border-indigo-400 bg-white flex flex-col items-center justify-center text-neutral-500 hover:text-indigo-600 cursor-pointer transition-colors p-2 text-center"
                    >
                      <Camera className="w-5 h-5 mb-1" />
                      <span className="text-[11px] font-bold">Snap or Upload Photo</span>
                    </div>
                  )}

                  <input 
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />

                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1/3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Operator</label>
                        <input 
                          type="text"
                          value={operator}
                          onChange={e => setOperator(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-neutral-300 rounded-lg outline-none"
                        />
                      </div>
                      <div className="w-2/3">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Placement Notes (Optional)</label>
                        <input 
                          type="text"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="e.g. Rolling cabinet 1 shelf 1 full; 5 items placed in overflow"
                          className="w-full text-xs px-3 py-1.5 bg-white border border-neutral-300 rounded-lg outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!submitSuccess && (
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-4">
            <div className="text-xs text-neutral-500">
              <span className="font-bold text-neutral-800">{selectedIds.length}</span> garments will be updated to <span className="font-bold text-emerald-600">shelved</span> status.
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || selectedIds.length === 0}
                onClick={handleConfirmShelved}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Confirming Shelving...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4 text-emerald-400" />
                    <span>Confirm Shelved All ({selectedIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
