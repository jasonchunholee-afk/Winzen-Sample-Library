import React, { useState, useEffect } from 'react';
import { Activity, Cpu, ShieldCheck, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

export const SessionDevPill: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [healthData, setHealthData] = useState<{
    heapUsedMB?: number;
    heapTotalMB?: number;
    rssMB?: number;
    heapPercent?: number;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = await res.json();
        if (json?.memory) {
          setHealthData(json.memory);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 25000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside aria-label="Session Governance" className="fixed bottom-3 right-3 z-50 font-mono text-xs select-none">
      {isOpen ? (
        <div className="bg-neutral-900/95 text-neutral-200 border border-neutral-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md w-72 mb-1.5 transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TOKEN & SYSTEM SENTINEL</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
              title="Minimize"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Session Guardrail:</span>
              <span className="text-emerald-400 font-medium bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                20-Turn Rule Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Memory Sentinel:</span>
              <span className="text-neutral-200">
                {healthData?.heapUsedMB ? `${healthData.heapUsedMB} MB (${healthData.heapPercent}%)` : 'Monitoring...'}
              </span>
            </div>

            {healthData?.rssMB && (
              <div className="flex items-center justify-between text-neutral-400">
                <span>RSS Allocation:</span>
                <span className="text-neutral-300">{healthData.rssMB} MB</span>
              </div>
            )}

            <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800/80 text-[10px] text-neutral-300 leading-relaxed">
              <span className="text-amber-400 font-semibold block mb-0.5">Token Conservation Standard:</span>
              Single-task modular prompts, surgical class diffs, and lightweight DTO payloads.
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-neutral-800 flex justify-between items-center text-[10px] text-neutral-400">
            <span>Winzen Garment Library</span>
            <button
              onClick={checkHealth}
              disabled={isChecking}
              className="flex items-center gap-1 text-neutral-300 hover:text-emerald-400 transition-colors"
              title="Ping Health"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Ping</span>
            </button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-neutral-900/90 hover:bg-neutral-800/95 text-neutral-200 hover:text-white border border-neutral-700/80 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-md transition-all group"
        title="Toggle Session Dev Pill"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-semibold text-[11px] tracking-tight">Session 1/20</span>
        <span className="text-[10px] text-neutral-400 border-l border-neutral-700 pl-1.5">
          {healthData?.heapUsedMB ? `${healthData.heapUsedMB}M` : 'OK'}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        ) : (
          <ChevronUp className="w-3 h-3 text-neutral-400 group-hover:text-neutral-200" />
        )}
      </button>
    </aside>
  );
};
