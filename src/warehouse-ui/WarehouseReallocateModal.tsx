import { useState } from 'react';
import { 
  X, ArrowRight, MoveRight, Layers, CheckCircle2, 
  Loader2, AlertCircle 
} from 'lucide-react';
import { WarehouseLocationItem, WarehouseGarment } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceLocation: WarehouseLocationItem | null;
  allLocations: WarehouseLocationItem[];
  onReallocated: () => Promise<void>;
}

export function WarehouseReallocateModal({ isOpen, onClose, sourceLocation, allLocations, onReallocated }: Props) {
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<string[]>([]);
  const [targetLocationCode, setTargetLocationCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !sourceLocation) return null;

  const garments = sourceLocation.garments || [];
  const targetLocation = allLocations.find(l => l.location_code === targetLocationCode);

  const toggleSelectGarment = (id: string) => {
    setSelectedGarmentIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedGarmentIds(garments.map(g => g.id));
  };

  const handleConfirmMove = async () => {
    if (selectedGarmentIds.length === 0) {
      setErrorMsg('Please select at least one garment to move.');
      return;
    }
    if (!targetLocationCode) {
      setErrorMsg('Please select a target destination stack.');
      return;
    }
    if (targetLocationCode === sourceLocation.location_code) {
      setErrorMsg('Target stack cannot be the same as the source stack.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await fetch('/api/warehouse/rearrange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: selectedGarmentIds,
          targetLocationCode,
          operator: 'Jason / Rhoda'
        })
      });
      const data = await res.json();
      if (data.success) {
        await onReallocated();
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to move garments');
      }
    } catch (err) {
      console.error('Error rearranging garments:', err);
      setErrorMsg('Network error while rearranging garments.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <MoveRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Rearrange & Reallocate Garments</h3>
              <p className="text-xs text-neutral-400">
                Move garments between stacks as customer volume expands
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
          
          {/* Source vs Target Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Source Stack */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Source Location</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-900">{sourceLocation.location_name}</span>
                <span className="text-xs font-mono font-bold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded">
                  {sourceLocation.location_code}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Current: {sourceLocation.current_count} items ({sourceLocation.assigned_buyer || 'All'} • {sourceLocation.assigned_type || 'All'})
              </p>
            </div>

            {/* Target Stack Selection */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-blue-500 block">Target Destination Stack</span>
              <select
                value={targetLocationCode}
                onChange={e => setTargetLocationCode(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Destination Stack --</option>
                {allLocations
                  .filter(l => l.location_code !== sourceLocation.location_code)
                  .map(loc => {
                    const remaining = loc.max_capacity_units - loc.current_count;
                    return (
                      <option key={loc.location_code} value={loc.location_code}>
                        {loc.location_name} ({loc.assigned_buyer || 'Unassigned'} • {loc.current_count}/{loc.max_capacity_units} units)
                      </option>
                    );
                  })}
              </select>

              {targetLocation && (
                <p className="text-xs text-blue-700">
                  Capacity: {targetLocation.current_count}/{targetLocation.max_capacity_units} units ({targetLocation.max_capacity_units - targetLocation.current_count} slots open)
                </p>
              )}
            </div>
          </div>

          {/* Garments List in Source Stack */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700">
                Select Garments to Move ({selectedGarmentIds.length} of {garments.length} selected)
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                Select All
              </button>
            </div>

            {garments.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-500 text-xs">
                No shelved garments currently located in this stack.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {garments.map(g => {
                  const isSelected = selectedGarmentIds.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleSelectGarment(g.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300 shadow-2xs' 
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      {g.thumb_url ? (
                        <img 
                          src={g.thumb_url} 
                          alt={g.id} 
                          className="w-10 h-10 rounded-lg object-cover bg-neutral-100 border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 text-[10px] shrink-0">
                          img
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-mono font-bold text-neutral-900 block truncate">
                          {g.id}
                        </span>
                        <span className="text-[11px] text-neutral-500 block truncate">
                          {g.buyer || 'Unknown'} • {g.garment_type || 'Apparel'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-4">
          <div className="text-xs text-neutral-500">
            Moving <span className="font-bold text-neutral-800">{selectedGarmentIds.length}</span> items
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
              disabled={isSubmitting || selectedGarmentIds.length === 0 || !targetLocationCode}
              onClick={handleConfirmMove}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Moving Garments...</span>
                </>
              ) : (
                <>
                  <MoveRight className="w-4 h-4 text-white" />
                  <span>Confirm Move to {targetLocationCode || 'Target'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
