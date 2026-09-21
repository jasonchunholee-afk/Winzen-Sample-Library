import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, ArrowRight, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface PendingChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
  initialGarmentId?: string;
}

export function PendingChangesModal({ isOpen, onClose, onApplied, initialGarmentId }: PendingChangesModalProps) {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pending-changes');
      const data = await res.json();
      setPendingList(data || []);
    } catch (err) {
      console.error("Error fetching pending changes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPending();
      setResultMsg(null);
      setCommandInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isSyntaxExact = commandInput.trim().toLowerCase() === 'apply approved changes';

  const handleApply = async () => {
    if (!isSyntaxExact) {
      setResultMsg({
        success: false,
        text: 'Command syntax must exactly match: "Apply Approved Changes"'
      });
      return;
    }

    setApplying(true);
    setResultMsg(null);
    try {
      const res = await fetch('/api/changes/apply-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandInput.trim(),
          garment_id: initialGarmentId || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setResultMsg({
          success: true,
          text: data.message || `Successfully activated changes and regenerated Archival Summaries!`
        });
        setCommandInput('');
        await fetchPending();
        if (onApplied) onApplied();
      } else {
        setResultMsg({
          success: false,
          text: data.error || 'Failed to activate approved changes.'
        });
      }
    } catch (err: any) {
      setResultMsg({
        success: false,
        text: err.message || 'Network error while applying changes.'
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900">Pending Changes & Approval Queue</h2>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingList.length} Pending
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Staged modifications, hashtag taxonomy updates, and structural field additions waiting for activation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPending}
              title="Refresh"
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Instruction callout */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">Activation Protocol: </span>
              Changes approved by reviewers remain in this pending queue until explicitly activated using the command syntax 
              <span className="font-mono font-bold bg-blue-100 px-1.5 py-0.5 rounded ml-1 text-blue-800">
                Apply Approved Changes
              </span>. 
              Activation writes all updates to the database, updates the Hashtags section, and triggers Gemini to regenerate an authoritative Archival Summary.
            </div>
          </div>

          {/* Pending Items List */}
          {loading && pendingList.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
              Loading pending queue...
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-xl">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <h3 className="font-bold text-neutral-800 text-sm">Queue is Clear</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                All approved garment modifications, hashtag sections, and structural changes are fully applied and synchronized.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingList.map((item) => (
                <div key={item.id} className="border border-neutral-200 rounded-xl p-4 bg-white hover:border-neutral-300 transition-all shadow-sm">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
                        {item.garment_id}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {item.garment?.buyer || 'Buyer Spec'} • {item.garment?.garment_type || 'Garment'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Pending Activation
                    </div>
                  </div>

                  {/* Feedback / note */}
                  {item.raw_feedback && (
                    <div className="mb-3 text-xs text-neutral-700 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                      <span className="font-semibold text-neutral-900">Reviewer Note: </span>
                      {item.raw_feedback}
                    </div>
                  )}

                  {/* Field changes preview */}
                  {item.parsedFieldChanges && Object.keys(item.parsedFieldChanges).length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        Staged Field Updates:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {Object.entries(item.parsedFieldChanges).map(([key, val]: [string, any]) => (
                          <div key={key} className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1">
                            <span className="font-mono text-neutral-500 font-semibold">{key}: </span>
                            <span className="text-neutral-900 font-medium">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structural requests */}
                  {item.parsedStructural && item.parsedStructural.length > 0 && (
                    <div className="mt-3">
                      <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                        Structural Schema Additions:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.parsedStructural.map((req: string, idx: number) => (
                          <span key={idx} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-mono">
                            + {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feedback banner */}
          {resultMsg && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${resultMsg.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {resultMsg.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <div>{resultMsg.text}</div>
            </div>
          )}
        </div>

        {/* Activation Command Footer */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isSyntaxExact && !applying) handleApply();
                }}
                placeholder='Type exact syntax: "Apply Approved Changes"'
                className={`w-full px-4 py-2.5 text-sm rounded-xl border font-mono transition-all outline-none ${isSyntaxExact ? 'border-green-500 bg-green-50/30 ring-2 ring-green-500/20 text-green-900 font-bold' : 'border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white text-neutral-800'}`}
              />
              <button
                type="button"
                onClick={() => setCommandInput('Apply Approved Changes')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-sans font-medium text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
              >
                Auto-fill
              </button>
            </div>

            <button
              type="button"
              disabled={!isSyntaxExact || applying || pendingList.length === 0}
              onClick={handleApply}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isSyntaxExact && !applying && pendingList.length > 0 ? 'bg-neutral-900 hover:bg-black text-white shadow-md cursor-pointer' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
            >
              {applying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Regenerating Archive...</span>
                </>
              ) : (
                <>
                  <span>Apply Approved Changes</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Activation runs schema commits, recalculates hashtag indexing, and generates a fresh Archival Summary version via Gemini with active rules.
          </p>
        </div>

      </div>
    </div>
  );
}
