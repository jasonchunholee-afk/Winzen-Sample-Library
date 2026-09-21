import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, ShieldAlert, Trash2, CheckCircle, RefreshCw, 
  Eye, Image as ImageIcon, Sparkles, Filter, ExternalLink 
} from 'lucide-react';
import { ImageViewerModal } from '../ImageViewerModal';

export interface QuarantinedItem {
  filename: string;
  garmentId: string;
  setClassification: string;
  status: string;
  rejectionReason: string | null;
  confidence: number;
  details: string;
  hasCareCardOrLabel?: boolean;
  thumbUrl: string;
  aiUrl: string;
  rawUrl: string;
}

interface QuarantineReviewTabProps {
  onCountChange?: (count: number) => void;
}

export function QuarantineReviewTab({ onCountChange }: QuarantineReviewTabProps) {
  const [items, setItems] = useState<QuarantinedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Lightbox preview for quarantined shot
  const [previewItem, setPreviewItem] = useState<QuarantinedItem | null>(null);

  const fetchQuarantine = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capture/quarantine');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.quarantined) ? data.quarantined : [];
        setItems(list);
        if (onCountChange) onCountChange(list.length);
      }
    } catch (err) {
      console.error('Failed to load quarantine list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuarantine();
  }, []);

  const handleDiscard = async (filename: string) => {
    if (!confirm(`Are you sure you want to permanently discard rejected frame ${filename}?`)) {
      return;
    }

    setActionLoading(filename);
    try {
      const res = await fetch('/api/capture/quarantine/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        setItems(prev => prev.filter(it => it.filename !== filename));
        setNotification({ text: `Discarded ${filename} permanently.`, type: 'success' });
        if (onCountChange) onCountChange(items.length - 1);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to discard item');
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleForceOverride = async (filename: string) => {
    setActionLoading(filename);
    try {
      const res = await fetch('/api/capture/quarantine/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        setItems(prev => prev.filter(it => it.filename !== filename));
        setNotification({ text: `Overridden! ${filename} released into active review.`, type: 'success' });
        if (onCountChange) onCountChange(items.length - 1);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to release item');
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              Automated Quality Gate Quarantine (Set B Frames)
              <span className="text-xs bg-amber-200 text-amber-900 font-mono px-2 py-0.5 rounded-full font-bold">
                {items.length} Pending
              </span>
            </h4>
            <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
              These frames were flagged as empty tables, bare backdrops, or non-garment accidental clicks by AI inspection. They are isolated from the active catalog and warehouse inventory until explicitly discarded or manually approved.
            </p>
          </div>
        </div>

        <button
          onClick={fetchQuarantine}
          disabled={loading}
          className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notification && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification.text}</span>
        </div>
      )}

      {/* Grid of Quarantined Frames */}
      {loading && items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs font-medium">Scanning quarantine database...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 bg-neutral-50 border border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center text-center p-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full mb-3">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h5 className="text-sm font-bold text-neutral-800">Quarantine Is Clean</h5>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Zero rejected or empty frames in isolation. All ingested batch shots are classified as Set A valid garments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[52vh] overflow-y-auto pr-1">
          {items.map((item) => (
            <div 
              key={item.filename}
              className="bg-white border border-red-200 rounded-xl p-3.5 shadow-xs hover:shadow-md transition-all flex gap-3.5 items-start"
            >
              {/* Thumbnail with zoom click */}
              <div 
                onClick={() => setPreviewItem(item)}
                className="w-24 h-24 bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200 shrink-0 relative group cursor-pointer"
                title="Click to inspect frame"
              >
                <img 
                  src={item.thumbUrl || item.aiUrl || item.rawUrl} 
                  alt={item.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('images/')) {
                      target.src = item.rawUrl;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye className="w-4 h-4" />
                </div>
              </div>

              {/* Triage Details & Actions */}
              <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      No garment detected
                    </span>
                    <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[10px] font-mono">
                      {item.confidence}% Confidence
                    </span>
                  </div>

                  <h5 className="font-mono text-xs font-bold text-neutral-900 truncate mt-1.5" title={item.filename}>
                    {item.filename}
                  </h5>

                  <p className="text-[11px] text-neutral-600 mt-1 line-clamp-2 leading-relaxed" title={item.details}>
                    {item.details || 'Shot rejected: table or background without clothing item.'}
                  </p>
                </div>

                {/* Operator Actions */}
                <div className="flex items-center gap-2 pt-3 mt-1 border-t border-neutral-100">
                  <button
                    onClick={() => handleDiscard(item.filename)}
                    disabled={actionLoading === item.filename}
                    className="px-2.5 py-1 bg-neutral-100 hover:bg-red-50 text-neutral-600 hover:text-red-700 border border-neutral-200 hover:border-red-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Permanently remove frame from database and storage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard
                  </button>

                  <button
                    onClick={() => handleForceOverride(item.filename)}
                    disabled={actionLoading === item.filename}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    title="Force override: Accept frame into active review"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Force Override
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewItem && (
        <ImageViewerModal
          isOpen={true}
          onClose={() => setPreviewItem(null)}
          imageUrl={previewItem.aiUrl || previewItem.rawUrl}
          title={`Quarantine Inspection: ${previewItem.filename}`}
          subtitle={`Set B Rejection: ${previewItem.rejectionReason || 'No Garment'} • ${previewItem.details}`}
        />
      )}
    </div>
  );
}
