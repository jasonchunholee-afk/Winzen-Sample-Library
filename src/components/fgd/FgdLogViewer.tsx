import React from 'react';
import { FgdJobLog } from './types';

export interface FgdLogViewerProps {
  logs: FgdJobLog[];
  logFilter: 'ALL' | 'STEP' | 'ERROR';
  setLogFilter: (filter: 'ALL' | 'STEP' | 'ERROR') => void;
  logsEndRef?: React.RefObject<HTMLDivElement | null>;
}

export const FgdLogViewer: React.FC<FgdLogViewerProps> = React.memo(({
  logs,
  logFilter,
  setLogFilter,
  logsEndRef
}) => {
  const filteredLogs = React.useMemo(() => {
    return logs.filter(l => {
      if (logFilter === 'STEP') return l.level === 'STEP' || l.level === 'SUCCESS';
      if (logFilter === 'ERROR') return l.level === 'ERROR' || l.level === 'WARN';
      return true;
    });
  }, [logs, logFilter]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
        <div className="flex items-center gap-2">
          <span>Filter Level:</span>
          <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
            <button
              onClick={() => setLogFilter('ALL')}
              className={`px-2 py-0.5 rounded ${logFilter === 'ALL' ? 'bg-neutral-800 text-white font-bold' : 'hover:text-neutral-200'}`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setLogFilter('STEP')}
              className={`px-2 py-0.5 rounded ${logFilter === 'STEP' ? 'bg-neutral-800 text-white font-bold' : 'hover:text-neutral-200'}`}
            >
              Milestones
            </button>
            <button
              onClick={() => setLogFilter('ERROR')}
              className={`px-2 py-0.5 rounded ${logFilter === 'ERROR' ? 'bg-neutral-800 text-white font-bold' : 'hover:text-neutral-200'}`}
            >
              Errors / Warnings
            </button>
          </div>
        </div>
        <span>Logs auto-sync from server worker thread</span>
      </div>

      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5 select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-neutral-500 py-4 text-center italic">
            Waiting for background worker log entries...
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2.5 hover:bg-neutral-900/60 p-1 rounded transition-colors">
              <span className="text-neutral-500 text-[11px] shrink-0 font-bold">
                +{log.elapsedSec}s
              </span>
              <span className="text-neutral-600 text-[11px] shrink-0">
                {log.timestamp}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 uppercase ${
                log.level === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                log.level === 'STEP' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                log.level === 'ERROR' ? 'bg-red-950 text-red-300 border border-red-800' :
                log.level === 'WARN' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-neutral-800 text-neutral-300'
              }`}>
                {log.level}
              </span>
              {log.garmentId && (
                <span className="text-blue-400 font-bold shrink-0 text-[11px]">
                  [{log.garmentId}]
                </span>
              )}
              {log.step && (
                <span className="text-neutral-400 text-[11px] shrink-0">
                  ({log.step})
                </span>
              )}
              <span className="text-neutral-200 break-words flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef as any} />
      </div>
    </div>
  );
});

FgdLogViewer.displayName = 'FgdLogViewer';
