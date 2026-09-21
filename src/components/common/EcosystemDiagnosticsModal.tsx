import React, { useState, useEffect } from 'react';
import { 
  Activity, Radio, AlertTriangle, CheckCircle2, XCircle, RefreshCw, 
  Send, ShieldAlert, Cpu, HardDrive, ArrowDownCircle, ExternalLink, X, Settings
} from 'lucide-react';
import { EcosystemDiagnostics, DiagnosticAlert, NodeMemoryStats } from '../../core/diagnostics/EcosystemDiagnostics';
import { CaptureBridge, PingResult, DEFAULT_CAPTURE_STATION_URL } from '../../core/bridges/CaptureBridge';
import { EcosystemCoordinator, GarmentLifecycleRecord } from '../../core/coordinator/EcosystemCoordinator';

interface EcosystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EcosystemDiagnosticsModal({ isOpen, onClose }: EcosystemDiagnosticsModalProps) {
  const diagnostics = EcosystemDiagnostics.getInstance();
  const bridge = CaptureBridge.getInstance();
  const coordinator = EcosystemCoordinator.getInstance();

  const [pingResult, setPingResult] = useState<PingResult | null>(bridge.getLastPingResult());
  const [memoryStats, setMemoryStats] = useState<NodeMemoryStats | null>(null);
  const [alerts, setAlerts] = useState<DiagnosticAlert[]>([]);
  const [records, setRecords] = useState<GarmentLifecycleRecord[]>([]);

  const [stationUrl, setStationUrl] = useState<string>(bridge.getStationUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Retake Notice Tester State
  const [retakeGarmentId, setRetakeGarmentId] = useState('TEMP-20260921-120000-01');
  const [retakeReason, setRetakeReason] = useState('Care label out of focus; macro blur');
  const [retakeSending, setRetakeSending] = useState(false);
  const [retakeFeedback, setRetakeFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initial query
    diagnostics.runProbeCycle();
    setRecords(coordinator.getAllRecords());

    const unsubscribe = diagnostics.subscribe((data) => {
      setPingResult(data.ping);
      setMemoryStats(data.memory);
      setAlerts(data.alerts);
      setRecords(coordinator.getAllRecords());
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePing = async () => {
    setIsPinging(true);
    try {
      const res = await bridge.ping();
      setPingResult(res);
    } finally {
      setIsPinging(false);
    }
  };

  const handleSaveUrl = () => {
    bridge.setStationUrl(stationUrl);
    setIsEditingUrl(false);
    handlePing();
  };

  const handleSyncPending = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await bridge.syncPendingCaptures();
      setSyncFeedback(`Successfully synchronized ${res.count} garments from ${res.source}.`);
      setRecords(coordinator.getAllRecords());
    } catch (err: any) {
      setSyncFeedback(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendTestRetake = async () => {
    if (!retakeGarmentId) return;
    setRetakeSending(true);
    setRetakeFeedback(null);
    try {
      const res = await bridge.sendRetakeNotice(
        retakeGarmentId, 
        retakeReason, 
        ['Label / Macro', 'Top 1 (Front)'],
        'Jennifer QA (Diagnostic Probe)'
      );
      setRetakeFeedback(res.message);
      setRecords(coordinator.getAllRecords());
    } catch (err: any) {
      setRetakeFeedback(`Error: ${err.message}`);
    } finally {
      setRetakeSending(false);
    }
  };

  // Lifecycle breakdown count
  const lifecycleCounts = records.reduce((acc, r) => {
    acc[r.state] = (acc[r.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 rounded-xl text-blue-400 border border-neutral-700">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                Distributed Ecosystem Coordinator & Sentinel
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                Main Hub &bull; REST Bridge to Satellite Capture Station
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Section 1: Capture Station REST Bridge */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 text-xs flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                Capture Station Satellite Bridge
              </span>

              <div className="flex items-center gap-2">
                {pingResult ? (
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border ${
                    pingResult.status === 'Connected' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : pingResult.status === 'Degraded'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {pingResult.status === 'Connected' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : pingResult.status === 'Degraded' ? (
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-600" />
                    )}
                    {pingResult.status} ({pingResult.latencyMs}ms)
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400">Probing...</span>
                )}

                <button
                  onClick={handlePing}
                  disabled={isPinging}
                  className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-700 font-semibold text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>Probe</span>
                </button>
              </div>
            </div>

            {/* Target URL field */}
            <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Configured Endpoint URL:</span>
                <button
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>{isEditingUrl ? 'Cancel' : 'Change Target'}</span>
                </button>
              </div>

              {isEditingUrl ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stationUrl}
                    onChange={(e) => setStationUrl(e.target.value)}
                    className="flex-1 font-mono text-xs px-3 py-1.5 border border-neutral-300 rounded-lg focus:outline-blue-500"
                    placeholder="https://ai.studio/apps/..."
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                  >
                    Save & Probe
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between font-mono text-neutral-800 bg-neutral-100/70 px-3 py-1.5 rounded-lg border border-neutral-200 truncate">
                  <span className="truncate">{stationUrl}</span>
                  <a 
                    href={stationUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-neutral-400 hover:text-neutral-700 ml-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Quick Actions: Inbound Sync & Outbound Retake Flag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-neutral-800 text-[11px] block">Inbound Batch Ingestion</span>
                <button
                  onClick={handleSyncPending}
                  disabled={isSyncing}
                  className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-black text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ArrowDownCircle className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? 'Pulling Batch...' : 'Sync Pending Captures'}</span>
                </button>
                {syncFeedback && (
                  <p className="text-[10px] text-neutral-600 font-mono">{syncFeedback}</p>
                )}
              </div>

              <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-neutral-800 text-[11px] block">Outbound Retake Notice Test</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={retakeGarmentId}
                    onChange={(e) => setRetakeGarmentId(e.target.value)}
                    className="flex-1 font-mono text-[11px] px-2 py-1 border border-neutral-300 rounded focus:outline-blue-500"
                    placeholder="Garment ID"
                  />
                  <button
                    onClick={handleSendTestRetake}
                    disabled={retakeSending}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>Push QA Flag</span>
                  </button>
                </div>
                {retakeFeedback && (
                  <p className="text-[10px] text-amber-800 font-mono">{retakeFeedback}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Node.js Memory Footprint Sentinel */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 text-xs flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                Main Coordinator Memory Sentinel (&lt;350MB Target)
              </span>
              {memoryStats && (
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                  memoryStats.status === 'OPTIMAL'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : memoryStats.status === 'ELEVATED'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  Status: {memoryStats.status}
                </span>
              )}
            </div>

            {memoryStats && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>Heap Used: {memoryStats.heapUsedMb} MB / {memoryStats.heapLimitMb} MB Budget</span>
                  <span>{Math.round((memoryStats.heapUsedMb / memoryStats.heapLimitMb) * 100)}%</span>
                </div>

                <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      memoryStats.heapUsedMb > 320 ? 'bg-rose-500' : memoryStats.heapUsedMb > 250 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.round((memoryStats.heapUsedMb / memoryStats.heapLimitMb) * 100))}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-[10px] font-mono text-neutral-600">
                  <div className="bg-white p-1.5 rounded border border-neutral-200">
                    <div className="text-neutral-400">Heap Total</div>
                    <div className="font-bold text-neutral-800">{memoryStats.heapTotalMb} MB</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-neutral-200">
                    <div className="text-neutral-400">Process RSS</div>
                    <div className="font-bold text-neutral-800">{memoryStats.rssMb} MB</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-neutral-200">
                    <div className="text-neutral-400">External Buffers</div>
                    <div className="font-bold text-neutral-800">{memoryStats.externalMb} MB</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-neutral-200">
                    <div className="text-neutral-400">Process Uptime</div>
                    <div className="font-bold text-neutral-800">{Math.round(memoryStats.uptimeSeconds / 60)} min</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Garment State Lifecycle Counter */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
            <span className="font-bold text-neutral-900 text-xs flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Ecosystem Lifecycle State Machine
            </span>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: 'Captured', key: 'CAPTURED', color: 'bg-neutral-200 text-neutral-800' },
                { label: 'Intake Validated', key: 'INTAKE_VALIDATED', color: 'bg-blue-100 text-blue-800' },
                { label: 'OCR Parsed', key: 'OCR_PARSED', color: 'bg-purple-100 text-purple-800' },
                { label: 'QA Pending', key: 'QA_PENDING', color: 'bg-amber-100 text-amber-800' },
                { label: 'Arbitration', key: 'ARBITRATION_REQUIRED', color: 'bg-rose-100 text-rose-800' },
                { label: 'Catalog Ready', key: 'CATALOG_PUBLISHED', color: 'bg-emerald-100 text-emerald-800' }
              ].map(st => (
                <div key={st.key} className="bg-white p-2 rounded-lg border border-neutral-200 text-center">
                  <div className="text-[10px] text-neutral-500 truncate">{st.label}</div>
                  <div className={`mt-1 font-mono font-bold text-xs px-1.5 py-0.5 rounded ${st.color}`}>
                    {lifecycleCounts[st.key] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Contract & Schema Validation Alerts Log */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Contract & Schema Validator Alerts ({alerts.length})
              </span>

              {alerts.length > 0 && (
                <button
                  onClick={() => diagnostics.clearAlerts()}
                  className="text-[10px] text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
                >
                  Clear Alerts
                </button>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-lg p-3 text-center text-neutral-400 font-mono text-[11px]">
                ✓ All satellite payloads conform to schema. No contract violations logged.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {alerts.map(a => (
                  <div 
                    key={a.id} 
                    className={`p-2.5 rounded-lg border flex items-start gap-2 text-[11px] ${
                      a.level === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {a.level === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{a.message}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        {new Date(a.timestamp).toLocaleTimeString()} &bull; {a.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-100 border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
