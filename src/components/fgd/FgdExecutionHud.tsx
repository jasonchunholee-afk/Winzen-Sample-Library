import React from 'react';
import { Clock, Terminal, ChevronUp, ChevronDown, Check, Copy } from 'lucide-react';
import { FgdJobState, FgdJobLog, GarmentTestReport } from './types';
import { FgdLogViewer } from './FgdLogViewer';

export interface FgdExecutionHudProps {
  running: boolean;
  activeJob: FgdJobState | null;
  elapsedSeconds: number;
  formatTimer: (seconds: number) => string;
  reports: GarmentTestReport[];
  logs: FgdJobLog[];
  showLogsPanel: boolean;
  setShowLogsPanel: (show: boolean) => void;
  logFilter: 'ALL' | 'STEP' | 'ERROR';
  setLogFilter: (filter: 'ALL' | 'STEP' | 'ERROR') => void;
  copiedReport: boolean;
  handleCopyReport: () => void;
  logsEndRef?: React.RefObject<HTMLDivElement | null>;
}

export const FgdExecutionHud: React.FC<FgdExecutionHudProps> = React.memo(({
  running,
  activeJob,
  elapsedSeconds,
  formatTimer,
  reports,
  logs,
  showLogsPanel,
  setShowLogsPanel,
  logFilter,
  setLogFilter,
  copiedReport,
  handleCopyReport,
  logsEndRef
}) => {
  if (!running && logs.length === 0) return null;

  return (
    <div className="bg-neutral-900 text-white rounded-2xl border border-neutral-800 shadow-md p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4">
          {/* Timer Block */}
          <div className="flex items-center gap-2.5 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-800">
            <Clock className={`w-4 h-4 ${running ? 'text-indigo-400 animate-pulse' : 'text-neutral-400'}`} />
            <div>
              <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Elapsed Time</div>
              <div className="text-lg font-mono font-bold text-white tracking-wider">
                {formatTimer(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Progress & Target Details */}
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {running ? 'Worker Thread Active' : (activeJob?.status === 'completed' ? 'Execution Completed' : 'Worker Thread Idle')}
              </span>
            </div>
            <div className="text-sm font-semibold text-neutral-200 mt-0.5">
              {activeJob?.currentStepDescription || (running ? 'Processing background test workload...' : `Evaluated ${reports.length} garments`)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogsPanel(!showLogsPanel)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>{showLogsPanel ? 'Hide Live Terminal' : 'Show Live Terminal'}</span>
            {showLogsPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {reports.length > 0 && (
            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReport ? 'Report Copied' : 'Copy QA Report'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Logs View */}
      {showLogsPanel && (
        <FgdLogViewer
          logs={logs}
          logFilter={logFilter}
          setLogFilter={setLogFilter}
          logsEndRef={logsEndRef}
        />
      )}
    </div>
  );
});

FgdExecutionHud.displayName = 'FgdExecutionHud';
