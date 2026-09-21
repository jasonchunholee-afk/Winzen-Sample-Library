/**
 * EcosystemDiagnostics.ts
 * 
 * Health Sentinel & Contract Validator for the Winzen Distributed Ecosystem.
 * 
 * Functions:
 * 1. Connectivity Probe: Periodic pinging of Capture Station with latency tracking.
 * 2. Contract & Schema Validator: Strict inspection of incoming JSON from Capture Station.
 * 3. Internal Sentinel: Node.js memory footprint monitoring (<350MB heap limit guard).
 */

import { CaptureBridge, PingResult, PendingGarmentCapture } from '../bridges/CaptureBridge';
import { EcosystemCoordinator } from '../coordinator/EcosystemCoordinator';

export interface DiagnosticAlert {
  id: string;
  type: 'SCHEMA_VIOLATION' | 'CONNECTIVITY_DROP' | 'MEMORY_PRESSURE' | 'CONTRACT_WARNING';
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: number;
}

export interface NodeMemoryStats {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  heapLimitMb: number;
  uptimeSeconds: number;
  status: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL';
}

export class EcosystemDiagnostics {
  private static instance: EcosystemDiagnostics;
  private bridge: CaptureBridge;
  private coordinator: EcosystemCoordinator;
  private alerts: DiagnosticAlert[] = [];
  private memoryStats: NodeMemoryStats | null = null;
  private intervalTimer: any = null;
  private listeners: Set<(stats: { ping: PingResult | null; memory: NodeMemoryStats | null; alerts: DiagnosticAlert[] }) => void> = new Set();

  private constructor() {
    this.bridge = CaptureBridge.getInstance();
    this.coordinator = EcosystemCoordinator.getInstance();
  }

  public static getInstance(): EcosystemDiagnostics {
    if (!EcosystemDiagnostics.instance) {
      EcosystemDiagnostics.instance = new EcosystemDiagnostics();
    }
    return EcosystemDiagnostics.instance;
  }

  /**
   * Start periodic background probes (30s interval)
   */
  public startProbes(): void {
    if (this.intervalTimer) return;
    this.runProbeCycle();
    this.intervalTimer = setInterval(() => {
      this.runProbeCycle();
    }, 30000);
  }

  public stopProbes(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public subscribe(fn: (stats: { ping: PingResult | null; memory: NodeMemoryStats | null; alerts: DiagnosticAlert[] }) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(fn => fn(snapshot));
  }

  public getSnapshot(): {
    ping: PingResult | null;
    memory: NodeMemoryStats | null;
    alerts: DiagnosticAlert[];
  } {
    return {
      ping: this.bridge.getLastPingResult(),
      memory: this.memoryStats,
      alerts: [...this.alerts]
    };
  }

  /**
   * Run a full probe cycle: Ping Bridge + Query Node.js Memory Sentinel
   */
  public async runProbeCycle(): Promise<void> {
    // 1. Probe Capture Station Connectivity
    const pingRes = await this.bridge.ping();
    if (!pingRes.connected) {
      this.addAlert({
        id: `conn-${Date.now()}`,
        type: 'CONNECTIVITY_DROP',
        level: 'warning',
        message: `Capture Station unreachable at ${pingRes.url} (${pingRes.details})`,
        timestamp: Date.now()
      });
    }

    // 2. Query Node.js Memory Sentinel
    await this.checkServerMemorySentinel();

    this.notify();
  }

  /**
   * Check Server Memory Footprint (<350MB heap target)
   */
  public async checkServerMemorySentinel(): Promise<NodeMemoryStats | null> {
    try {
      const res = await fetch('/api/diagnostics/sentinel');
      if (res.ok) {
        const stats: NodeMemoryStats = await res.json();
        this.memoryStats = stats;

        if (stats.heapUsedMb > 320) {
          this.addAlert({
            id: `mem-${Date.now()}`,
            type: 'MEMORY_PRESSURE',
            level: stats.heapUsedMb > 350 ? 'error' : 'warning',
            message: `Node.js memory heap elevated: ${stats.heapUsedMb}MB / ${stats.heapLimitMb}MB limit. Container crash prevention active.`,
            details: stats,
            timestamp: Date.now()
          });
        }
        return stats;
      }
    } catch {
      // Ignored if route is initializing
    }
    return null;
  }

  /**
   * Contract & Schema Validator for Incoming Capture Station Batches
   */
  public validateCapturePayload(payload: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push("Payload is not a valid JSON object.");
      return { valid: false, errors, warnings };
    }

    // 1. Garment ID validation
    const garmentId = payload.garmentId || payload.id;
    if (!garmentId || typeof garmentId !== 'string') {
      errors.push("Missing mandatory 'garmentId' string identifier.");
    } else {
      const isStandard = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(garmentId);
      const isTemporary = /^TEMP-\d{8}-\d{6}-\d{2,4}$/i.test(garmentId) || garmentId.startsWith('TEMP-');
      const isWinzenCustom = garmentId.startsWith('WZ-');

      if (!isStandard && !isTemporary && !isWinzenCustom) {
        warnings.push(`Garment ID '${garmentId}' deviates from standard nomenclature (expected WZ-*, TEMP-*, or Style Code).`);
      }
    }

    // 2. Images Sequence Validation
    const images = payload.images || payload.shots;
    if (!Array.isArray(images) || images.length === 0) {
      errors.push(`Garment '${garmentId}' contains no photographic shots in 'images' array.`);
    } else {
      const roles = images.map((img: any) => (img.role || '').toLowerCase());
      const hasFront = roles.some(r => r.includes('front') || r.includes('top_1'));
      const hasLabelOrMacro = roles.some(r => r.includes('label') || r.includes('macro') || r.includes('tag'));

      if (!hasFront) {
        warnings.push(`Capture Station payload for '${garmentId}' is missing mandatory 'Front' photo angle.`);
      }

      if (!hasLabelOrMacro) {
        warnings.push(`Capture Station payload for '${garmentId}' is missing 'Label / Spec Sheet' macro shot.`);
      }

      // Check URL completeness
      images.forEach((img: any, idx: number) => {
        if (!img.url && !img.dataUrl && !img.rawUrl && !img.thumbUrl) {
          errors.push(`Image shot #${idx + 1} for '${garmentId}' is missing image source URL.`);
        }
      });
    }

    // Record alerts if violations occurred
    if (errors.length > 0 || warnings.length > 0) {
      const alertType = errors.length > 0 ? 'SCHEMA_VIOLATION' : 'CONTRACT_WARNING';
      this.addAlert({
        id: `schema-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: alertType,
        level: errors.length > 0 ? 'error' : 'warning',
        message: errors.length > 0 
          ? `Schema violation in capture payload: ${errors.join('; ')}`
          : `Contract notice in capture payload: ${warnings.join('; ')}`,
        details: { garmentId, errors, warnings },
        timestamp: Date.now()
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public addAlert(alert: DiagnosticAlert): void {
    this.alerts = [alert, ...this.alerts].slice(0, 50); // Keep last 50 alerts
    this.coordinator.dispatch('DIAGNOSTIC_ALERT', alert);
    this.notify();
  }

  public clearAlerts(): void {
    this.alerts = [];
    this.notify();
  }
}
