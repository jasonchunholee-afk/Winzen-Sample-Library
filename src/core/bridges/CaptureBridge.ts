/**
 * CaptureBridge.ts
 * 
 * REST Bridge connecting Winzen Main Coordinator with the dedicated Capture Station applet:
 * (Target: https://ai.studio/apps/bf688cb8-b95b-47f3-920b-441a734e4f6d)
 * 
 * Capabilities:
 * 1. Ping & Latency Probe (Connected / Degraded / Unreachable).
 * 2. Inbound Sync: syncPendingCaptures() fetches newly photographed multi-shot batches.
 * 3. Outbound Feedback: sendRetakeNotice() dispatches QA reshoot flags to Chen's station.
 * 4. Automatic routing through server-side proxy (/api/bridge/capture/*) to avoid CORS.
 */

import { EcosystemCoordinator } from '../coordinator/EcosystemCoordinator';

export interface CaptureImagePayload {
  filename: string;
  role: 'Front' | 'Back' | 'Label' | 'Detail' | string;
  url: string;
  thumbUrl?: string;
  aiUrl?: string;
  rawUrl?: string;
  capturedAt?: number;
  cameraType?: 'top' | 'macro';
}

export interface PendingGarmentCapture {
  garmentId: string;
  temporaryStickerCode?: string;
  isStickerMode?: boolean;
  capturedAt: number;
  stationId: string;
  operator: string;
  shotsCount: number;
  images: CaptureImagePayload[];
  warehouseLocationDraft?: {
    locationCode: string;
    tempContainer?: string;
  };
}

export interface PingResult {
  connected: boolean;
  status: 'Connected' | 'Degraded' | 'Unreachable';
  latencyMs: number;
  url: string;
  timestamp: number;
  details?: string;
}

export interface RetakeNoticePayload {
  garmentId: string;
  reason: string;
  failedAngles: string[];
  requestedBy?: string;
  timestamp?: number;
}

const STORAGE_KEY_CAPTURE_URL = 'winzen_capture_station_url';
export const DEFAULT_CAPTURE_STATION_URL = 'https://ai.studio/apps/bf688cb8-b95b-47f3-920b-441a734e4f6d';

export class CaptureBridge {
  private static instance: CaptureBridge;
  private stationUrl: string;
  private coordinator: EcosystemCoordinator;
  private lastPingResult: PingResult | null = null;

  private constructor() {
    this.coordinator = EcosystemCoordinator.getInstance();
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CAPTURE_URL) : null;
    this.stationUrl = stored || DEFAULT_CAPTURE_STATION_URL;
  }

  public static getInstance(): CaptureBridge {
    if (!CaptureBridge.instance) {
      CaptureBridge.instance = new CaptureBridge();
    }
    return CaptureBridge.instance;
  }

  public getStationUrl(): string {
    return this.stationUrl;
  }

  public setStationUrl(url: string): void {
    this.stationUrl = url.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CAPTURE_URL, this.stationUrl);
    }
    // Also update server-side proxy config
    fetch('/api/bridge/capture/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: this.stationUrl })
    }).catch(err => console.warn('[CaptureBridge] Failed to sync config with server proxy:', err));
  }

  /**
   * Ping the Capture Station via the server proxy to verify connectivity and measure latency
   */
  public async ping(): Promise<PingResult> {
    const startTime = performance.now();
    try {
      // Use Main server's proxy route to bypass cross-origin browser CORS restrictions
      const response = await fetch('/api/bridge/capture/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: this.stationUrl })
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const status: 'Connected' | 'Degraded' = latencyMs > 300 ? 'Degraded' : 'Connected';
        this.lastPingResult = {
          connected: true,
          status,
          latencyMs,
          url: this.stationUrl,
          timestamp: Date.now(),
          details: data.message || 'Capture Station operational'
        };
      } else {
        this.lastPingResult = {
          connected: false,
          status: 'Unreachable',
          latencyMs,
          url: this.stationUrl,
          timestamp: Date.now(),
          details: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      this.lastPingResult = {
        connected: false,
        status: 'Unreachable',
        latencyMs,
        url: this.stationUrl,
        timestamp: Date.now(),
        details: err.message || 'Connection refused or timeout'
      };
    }

    return this.lastPingResult;
  }

  public getLastPingResult(): PingResult | null {
    return this.lastPingResult;
  }

  /**
   * Inbound Sync: Poll newly captured garment batches from Capture Station
   */
  public async syncPendingCaptures(): Promise<{
    count: number;
    captures: PendingGarmentCapture[];
    source: 'remote' | 'internal_buffer' | 'mock';
  }> {
    try {
      const res = await fetch('/api/bridge/capture/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: this.stationUrl })
      });

      if (res.ok) {
        const data = await res.json();
        const captures: PendingGarmentCapture[] = data.captures || [];

        // Notify EcosystemCoordinator of all ingested captures
        for (const cap of captures) {
          this.coordinator.transitionState(cap.garmentId, 'CAPTURED', 'CaptureBridge', 'Received via REST Bridge');
          this.coordinator.dispatch('CAPTURE_RECEIVED', cap);
        }

        return {
          count: captures.length,
          captures,
          source: data.source || 'remote'
        };
      }
      throw new Error(`Proxy responded with status ${res.status}`);
    } catch (err) {
      console.warn('[CaptureBridge] Remote sync failed, attempting internal buffer fallback:', err);
      // Fallback: Query internal capture worklist if remote station is temporarily offline
      return await this.fetchInternalFallbackCaptures();
    }
  }

  /**
   * Outbound Feedback: Push QA rejection flag to Chen's Capture Station retake queue
   */
  public async sendRetakeNotice(
    garmentId: string, 
    reason: string, 
    failedAngles: string[],
    requestedBy = 'Jennifer QA'
  ): Promise<{ success: boolean; message: string }> {
    const payload: RetakeNoticePayload = {
      garmentId,
      reason,
      failedAngles,
      requestedBy,
      timestamp: Date.now()
    };

    try {
      const res = await fetch('/api/bridge/capture/retake-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: this.stationUrl,
          notice: payload
        })
      });

      if (res.ok) {
        // Transition lifecycle state
        this.coordinator.transitionState(
          garmentId, 
          'RETAKE_REQUESTED', 
          requestedBy, 
          `Flagged angles: ${failedAngles.join(', ')}. Reason: ${reason}`
        );
        this.coordinator.dispatch('QA_FLAGGED_RETAKE', payload);
        return { success: true, message: `Retake notice successfully pushed to Capture Station.` };
      }

      throw new Error(`Failed to transmit retake notice (${res.status})`);
    } catch (err: any) {
      console.error('[CaptureBridge] Error sending retake notice:', err);
      return { success: false, message: `Failed to deliver retake notice: ${err.message}` };
    }
  }

  /**
   * Internal Fallback: pulls provisional captured items currently pending in Main
   */
  private async fetchInternalFallbackCaptures(): Promise<{
    count: number;
    captures: PendingGarmentCapture[];
    source: 'internal_buffer';
  }> {
    try {
      const res = await fetch('/api/garments');
      if (res.ok) {
        const garments = await res.json();
        const pending = garments
          .filter((g: any) => g.status === 'Review' || g.id.startsWith('TEMP-') || g.id.startsWith('WZ-'))
          .slice(0, 10)
          .map((g: any): PendingGarmentCapture => ({
            garmentId: g.id,
            temporaryStickerCode: g.id.startsWith('TEMP-') ? g.id : undefined,
            isStickerMode: g.id.startsWith('TEMP-'),
            capturedAt: Date.now() - 3600000,
            stationId: 'Capture-Station-Alpha',
            operator: 'Chen',
            shotsCount: g.images?.length || 0,
            images: (g.images || []).map((img: any) => ({
              filename: img.filename || `${g.id} (${img.role || 'Front'}).jpg`,
              role: img.role || 'Front',
              url: img.url,
              thumbUrl: img.thumbUrl,
              aiUrl: img.aiUrl,
              rawUrl: img.rawUrl
            }))
          }));

        return {
          count: pending.length,
          captures: pending,
          source: 'internal_buffer'
        };
      }
    } catch {
      // Ignored
    }

    return { count: 0, captures: [], source: 'internal_buffer' };
  }
}
