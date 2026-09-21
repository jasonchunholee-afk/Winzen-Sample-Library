import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2, Send, Radio } from 'lucide-react';
import { CaptureBridge } from '../../core/bridges/CaptureBridge';

interface RetakeItem {
  garmentId: string;
  buyer: string;
  styleNo: string;
  reason: string;
  requestedAngle: string;
  status: string;
  imagesCount: number;
  lastUpdated: string;
}

interface RetakeQueueViewerProps {
  onSelectGarment?: (garmentId: string) => void;
}

/**
 * RetakeQueueViewer - Displays garments flagged by Jennifer or AI for photography reshoots.
 */
export function RetakeQueueViewer({ onSelectGarment }: RetakeQueueViewerProps) {
  const [items, setItems] = useState<RetakeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [transmittingId, setTransmittingId] = useState<string | null>(null);
  const [transmittedMap, setTransmittedMap] = useState<Record<string, string>>({});

  const handleTransmitToBridge = async (item: RetakeItem) => {
    setTransmittingId(item.garmentId);
    try {
      const bridge = CaptureBridge.getInstance();
      const res = await bridge.sendRetakeNotice(
        item.garmentId,
        item.reason,
        [item.requestedAngle],
        'Jennifer QA'
      );
      setTransmittedMap(prev => ({ ...prev, [item.garmentId]: res.message || 'Transmitted' }));
    } catch (err: any) {
      setTransmittedMap(prev => ({ ...prev, [item.garmentId]: `Error: ${err.message}` }));
    } finally {
      setTransmittingId(null);
    }
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capture/retake-queue');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Failed to fetch retake queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <span>Photo Booth Retake Queue</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                {items.length} Pending
              </span>
            </h3>
            <p className="text-xs text-neutral-500">
              Garments flagged by Jennifer for re-shooting (unfocused label, missing view, or sample revision).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
          ✓ All photo angles approved. No pending retakes in the worklist.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div key={item.garmentId} className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-neutral-900">{item.garmentId}</span>
                  <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                    {item.buyer}
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Angle: {item.requestedAngle}
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{item.reason}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTransmitToBridge(item)}
                  disabled={transmittingId === item.garmentId}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Push QA reshoot notice to Chen's Capture Station via REST Bridge"
                >
                  <Radio className={`w-3.5 h-3.5 ${transmittingId === item.garmentId ? 'animate-spin' : ''}`} />
                  <span>{transmittedMap[item.garmentId] ? 'Pushed' : 'Push to Station'}</span>
                </button>

                {onSelectGarment && (
                  <button
                    type="button"
                    onClick={() => onSelectGarment(item.garmentId)}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>Review in Library</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
