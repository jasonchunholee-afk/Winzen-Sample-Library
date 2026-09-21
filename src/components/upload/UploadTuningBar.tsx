import React from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';

interface UploadTuningBarProps {
  packetSizeKb: number;
  setPacketSizeKb: (val: number) => void;
  concurrency: number;
  setConcurrency: (val: number) => void;
  uploading: boolean;
  onOpenDiagnostics: () => void;
}

/**
 * UploadTuningBar - Packet Sizing, Worker Concurrency, and Diagnostic Trigger
 */
export function UploadTuningBar({
  packetSizeKb,
  setPacketSizeKb,
  concurrency,
  setConcurrency,
  uploading,
  onOpenDiagnostics
}: UploadTuningBarProps) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Packet Size */}
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-neutral-500" />
          <span className="font-medium text-neutral-600">Packet Size:</span>
          <select
            value={packetSizeKb}
            onChange={(e) => setPacketSizeKb(Number(e.target.value))}
            disabled={uploading}
            className="bg-white border border-neutral-300 rounded px-2 py-1 text-neutral-800 font-mono text-[11px]"
          >
            <option value={512}>512 KB (Mobile/Slow)</option>
            <option value={1024}>1024 KB (1 MB Balanced)</option>
            <option value={1536}>1536 KB (1.5 MB Fast)</option>
            <option value={2048}>2048 KB (2 MB High Speed)</option>
          </select>
        </div>

        {/* Concurrency */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium text-neutral-600">Parallel Workers:</span>
          <select
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            disabled={uploading}
            className="bg-white border border-neutral-300 rounded px-2 py-1 text-neutral-800 font-mono text-[11px]"
          >
            <option value={1}>1 Worker (Serial Safe)</option>
            <option value={2}>2 Workers (Concurrent)</option>
          </select>
        </div>
      </div>

      {/* Diagnostic Logs Button */}
      <button
        type="button"
        onClick={onOpenDiagnostics}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md text-neutral-700 font-medium transition-colors cursor-pointer shadow-2xs"
      >
        <Activity className="w-3.5 h-3.5 text-indigo-600" />
        <span>Audit Logs</span>
      </button>
    </div>
  );
}
