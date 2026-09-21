import React from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check, X, Loader2, Sparkles } from 'lucide-react';

export interface FgdWipePendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmWipe: (scope: 'last_round' | 'current' | 'all') => Promise<void>;
  isWiping: boolean;
  pendingCount: number;
  currentGarmentId?: string;
  scope: 'last_round' | 'current' | 'all';
  setScope: (scope: 'last_round' | 'current' | 'all') => void;
}

export const FgdWipePendingModal: React.FC<FgdWipePendingModalProps> = ({
  isOpen,
  onClose,
  onConfirmWipe,
  isWiping,
  pendingCount,
  currentGarmentId,
  scope,
  setScope
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Wipe Out Pending Rule Amendments
              </h3>
              <p className="text-xs text-neutral-500">
                Discard unapproved candidate rules generated during FGD evaluations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Overview Banner */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">
                {pendingCount > 0 ? (
                  <>You have <strong className="underline decoration-amber-400">{pendingCount} unapproved pending rule(s)</strong> awaiting review.</>
                ) : (
                  <>No pending rules are currently awaiting approval in the active reports.</>
                )}
              </p>
              <p className="text-amber-800 leading-relaxed">
                This action will wipe out candidate rule amendments from the test evaluation reports so they no longer appear in the approval queue.
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Select Wipe Scope:
            </label>
            <div className="space-y-2">
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  scope === 'last_round' 
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300 text-neutral-900' 
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100/60'
                }`}
              >
                <input
                  type="radio"
                  name="wipeScope"
                  checked={scope === 'last_round'}
                  onChange={() => setScope('last_round')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>Last Review Round</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Wipes candidate rules generated from the latest round of &ldquo;Re-run FGD for garments under review&rdquo; or the most recent evaluation batch.
                  </p>
                </div>
              </label>

              {currentGarmentId && (
                <label 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    scope === 'current' 
                      ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300 text-neutral-900' 
                      : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="wipeScope"
                    checked={scope === 'current'}
                    onChange={() => setScope('current')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-neutral-900">
                      Current Garment Only ({currentGarmentId})
                    </div>
                    <p className="text-xs text-neutral-500">
                      Wipes candidate rules associated exclusively with the currently selected garment report.
                    </p>
                  </div>
                </label>
              )}

              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  scope === 'all' 
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300 text-neutral-900' 
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100/60'
                }`}
              >
                <input
                  type="radio"
                  name="wipeScope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-neutral-900">
                    All Historical Reports
                  </div>
                  <p className="text-xs text-neutral-500">
                    Purges all unapproved pending candidate rules across all archived reports.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Database Safeguard Notice */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 text-xs flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-emerald-800 leading-normal">
              <strong>Safe Guarantee:</strong> Active rules already approved and archived into the Rules Catalog will <strong>never</strong> be deleted or altered.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmWipe(scope)}
            disabled={isWiping}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isWiping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Wiping Rules...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Wipe Out Pending Rules</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
