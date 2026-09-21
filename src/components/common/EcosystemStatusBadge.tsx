import React, { useState, useEffect } from 'react';
import { Radio, CheckCircle2, AlertTriangle, XCircle, Cpu } from 'lucide-react';
import { EcosystemDiagnostics, NodeMemoryStats } from '../../core/diagnostics/EcosystemDiagnostics';
import { CaptureBridge, PingResult } from '../../core/bridges/CaptureBridge';
import { EcosystemDiagnosticsModal } from './EcosystemDiagnosticsModal';

export function EcosystemStatusBadge() {
  const diagnostics = EcosystemDiagnostics.getInstance();
  const bridge = CaptureBridge.getInstance();

  const [pingResult, setPingResult] = useState<PingResult | null>(bridge.getLastPingResult());
  const [memoryStats, setMemoryStats] = useState<NodeMemoryStats | null>(null);
  const [hasAlerts, setHasAlerts] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    diagnostics.startProbes();

    const unsubscribe = diagnostics.subscribe((data) => {
      setPingResult(data.ping);
      setMemoryStats(data.memory);
      setHasAlerts(data.alerts.length > 0);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isConnected = pingResult?.connected;
  const isDegraded = pingResult?.status === 'Degraded';

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all bg-neutral-900/5 hover:bg-neutral-900/10 border border-neutral-200/80 cursor-pointer select-none"
        title="Click to open Ecosystem Diagnostics & Capture Bridge Monitor"
      >
        {/* Bridge Status Indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isDegraded ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? (isDegraded ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-neutral-400'
            }`} />
          </span>

          <span className="font-semibold text-neutral-700 hidden sm:inline">
            Capture:
          </span>
          <span className="font-mono text-neutral-600">
            {isConnected ? `${pingResult?.latencyMs}ms` : 'Offline'}
          </span>
        </div>

        {/* Separator */}
        <span className="text-neutral-300">|</span>

        {/* Memory Sentinel Indicator */}
        <div className="flex items-center gap-1 font-mono text-neutral-600">
          <Cpu className="w-3 h-3 text-neutral-400" />
          <span>{memoryStats ? `${memoryStats.heapUsedMb}M` : '...'}</span>
        </div>

        {hasAlerts && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Active schema or contract notices" />
        )}
      </button>

      {/* Diagnostics Modal */}
      <EcosystemDiagnosticsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
