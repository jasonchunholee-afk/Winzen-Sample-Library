import React from 'react';
import { X, Activity, RefreshCw, Trash2 } from 'lucide-react';

interface UploadDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

export function UploadDiagnosticModal({
  isOpen,
  onClose,
  logs,
  isLoading,
  onRefresh,
  onClear
}: UploadDiagnosticModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-neutral-900 text-sm">Resilient Chunk Transmission Audit Log</h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
              {logs.length} packet events
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 hover:text-red-800 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1.5 bg-neutral-950 text-neutral-200 rounded-b-2xl">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 font-sans">
              No packet events recorded yet. Logs populate automatically as chunks are transmitted.
            </div>
          ) : (
            logs.map((log, idx) => {
              const statusColor = 
                log.status === 'SUCCESS' ? 'text-emerald-400' :
                log.status === 'RETRY' ? 'text-amber-400' :
                log.status === 'FAILED' ? 'text-rose-400' : 'text-neutral-400';

              return (
                <div key={idx} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-neutral-900/80 border-b border-neutral-900">
                  <span className="text-neutral-500 select-none">[{log.timestamp || '-'}]</span>
                  <span className={`font-bold ${statusColor} min-w-[70px]`}>{log.status}</span>
                  <span className="text-neutral-300">
                    Chunk {log.chunk_index !== undefined ? log.chunk_index + 1 : '?'}/{log.total_chunks || '?'}
                  </span>
                  {log.duration_ms !== undefined && (
                    <span className="text-neutral-500">({log.duration_ms}ms)</span>
                  )}
                  {log.http_status && (
                    <span className={`px-1 rounded text-[10px] ${log.http_status === 200 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                      HTTP {log.http_status}
                    </span>
                  )}
                  <span className="text-neutral-400 flex-1 truncate">{log.message || log.error || ''}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
