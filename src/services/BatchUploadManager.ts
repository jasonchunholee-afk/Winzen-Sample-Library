/**
 * BatchUploadManager - Object-Oriented Multi-File Concurrent Ingestion Coordinator
 * 
 * Architectural Responsibilities:
 * 1. Decouples batch upload orchestration, worker pool concurrency, and cancellation from UI components.
 * 2. Implements internal discrete step functions (functions-within-a-function pattern) for:
 *    - item slicing and engine initialization
 *    - worker lifecycle dispatch
 *    - error categorization and retry queuing
 *    - server response normalization (exact duplicates, review shots, canonical angles)
 * 3. Provides clean subscription APIs for UI state bindings.
 */

import { ChunkUploadEngine } from './ChunkUploadEngine';

export interface BatchItem {
  id: string;
  file: File;
  garmentId: string;
  role: 'Front' | 'Back' | 'Label';
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
  uploadedUrl?: string;
  uploadSessionId: string;
  progressPercent?: number;
  chunkProgress?: string;
  fileHash?: string;
}

/**
 * Calculates SHA-256 fingerprint in browser using Web Crypto API without external dependencies.
 */
export async function computeFileHash(file: File): Promise<string> {
  try {
    const slice = file.slice(0, Math.min(file.size, 4 * 1024 * 1024));
    const buffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }
}

export interface BatchManagerOptions {
  packetSizeKb?: number;
  concurrency?: number;
  onItemUpdate?: (item: BatchItem) => void;
  onGarmentImageUpdated?: (garmentId: string, imageInfo: any) => void;
  onBatchComplete?: () => void;
}

export class BatchUploadManager {
  private items: BatchItem[] = [];
  private packetSizeKb: number = 1536;
  private concurrency: number = 2;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private abortController: AbortController | null = null;
  private onItemUpdateCb?: (item: BatchItem) => void;
  private onGarmentImageUpdatedCb?: (garmentId: string, imageInfo: any) => void;
  private onBatchCompleteCb?: () => void;

  constructor(options?: BatchManagerOptions) {
    if (options?.packetSizeKb) this.packetSizeKb = options.packetSizeKb;
    if (options?.concurrency) this.concurrency = options.concurrency;
    this.onItemUpdateCb = options?.onItemUpdate;
    this.onGarmentImageUpdatedCb = options?.onGarmentImageUpdated;
    this.onBatchCompleteCb = options?.onBatchComplete;
  }

  public setOptions(options: { packetSizeKb?: number; concurrency?: number }) {
    if (options.packetSizeKb !== undefined) this.packetSizeKb = options.packetSizeKb;
    if (options.concurrency !== undefined) this.concurrency = options.concurrency;
  }

  public setItems(items: BatchItem[]) {
    this.items = [...items];
  }

  public getItems(): BatchItem[] {
    return [...this.items];
  }

  public updateItem(id: string, updates: Partial<BatchItem>): BatchItem | undefined {
    const idx = this.items.findIndex(it => it.id === id);
    if (idx >= 0) {
      this.items[idx] = { ...this.items[idx], ...updates };
      const updated = this.items[idx];
      if (this.onItemUpdateCb) {
        this.onItemUpdateCb(updated);
      }
      return updated;
    }
    return undefined;
  }

  public removeItem(id: string): void {
    this.items = this.items.filter(it => it.id !== id);
  }

  public isBusy(): boolean {
    return this.isRunning;
  }

  /**
   * Primary Entry Point: Starts batch execution across pending items using concurrent workers.
   */
  public async startBatch(): Promise<void> {
    if (this.isRunning) return;

    const pending = this.items.filter(it => it.status === 'pending' || it.status === 'failed');
    if (pending.length === 0) return;

    this.isRunning = true;
    this.isCancelled = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const workerCount = Math.min(this.concurrency, pending.length, 3);
    let queueIndex = 0;

    // Sub-component function: Individual concurrent worker loop
    const runWorker = async (workerId: number) => {
      while (queueIndex < pending.length && !this.isCancelled && !signal.aborted) {
        const item = pending[queueIndex++];
        if (!item) break;
        await this.executeSingleUpload(item, signal);
      }
    };

    const workerPromises = Array.from({ length: workerCount }, (_, i) => runWorker(i));
    await Promise.all(workerPromises);

    this.isRunning = false;
    this.abortController = null;

    if (this.onBatchCompleteCb) {
      this.onBatchCompleteCb();
    }
  }

  /**
   * Gracefully stops active workers and aborts in-flight network packets.
   */
  public stopBatch(): void {
    this.isCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
  }

  /**
   * Retries an individual item without restarting the whole batch.
   */
  public async retrySingleItem(item: BatchItem): Promise<boolean> {
    const ctrl = new AbortController();
    return await this.executeSingleUpload(item, ctrl.signal);
  }

  /**
   * Discrete execution engine for a single item (Functions-within-a-function decomposition).
   */
  private async executeSingleUpload(item: BatchItem, signal: AbortSignal): Promise<boolean> {
    this.updateItem(item.id, {
      status: 'processing',
      error: undefined,
      chunkProgress: 'Connecting stream...'
    });

    try {
      if (this.isCancelled || signal.aborted) {
        throw new Error('Upload cancelled');
      }

      // 0. Client-Side Pre-Hashing: Calculate hash to detect redundant uploads before sending packets
      const fileHash = item.fileHash || await computeFileHash(item.file);
      this.updateItem(item.id, { fileHash });

      // Fast check: Is there already another successful item in this batch with the identical hash and garmentId?
      const existingSuccess = this.items.find(
        other => other.id !== item.id &&
                 other.garmentId === item.garmentId &&
                 other.status === 'success' &&
                 other.fileHash === fileHash
      );
      if (existingSuccess) {
        this.updateItem(item.id, {
          status: 'success',
          progressPercent: 100,
          chunkProgress: 'Duplicate Deleted (Identical)',
          uploadedUrl: existingSuccess.uploadedUrl
        });
        return true;
      }

      // 1. Packet Sizing: Fast-path if file is <= 3.5MB, otherwise apply chunk sizing
      const effectivePacketSize = item.file.size <= 3.5 * 1024 * 1024
        ? item.file.size
        : this.packetSizeKb * 1024;

      // 2. Engine Initialization
      const engine = new ChunkUploadEngine(
        item.file,
        item.uploadSessionId,
        item.garmentId,
        item.role,
        {
          chunkSize: effectivePacketSize,
          concurrency: 1,
          maxRetries: 3
        }
      );

      // 3. Progress Telemetry Binding
      engine.onProgress((info) => {
        const speedText = info.speedMBps > 0 ? ` • ${info.speedMBps} MB/s` : '';
        const etaText = info.etaSeconds > 0 ? ` • ETA ${info.etaSeconds}s` : '';
        this.updateItem(item.id, {
          progressPercent: info.percent,
          chunkProgress: `Packet ${info.completedChunks}/${info.totalChunks}${speedText}${etaText}`
        });
      });

      // 4. Packet Streaming Execution
      const serverResult = await engine.start(signal);

      if (!serverResult || !serverResult.success) {
        throw new Error('Server assembly incomplete');
      }

      // 5. Normalization & State Propagation
      const confirmedRole = serverResult.role || item.role;
      const newImageInfo = {
        id: serverResult.imageId || serverResult.filename || item.file.name,
        role: confirmedRole,
        filename: serverResult.filename,
        isReview: !!serverResult.isDifferentShot,
        url: serverResult.url || `/images_thumb/${serverResult.filename || item.file.name}`,
        fullUrl: serverResult.fullUrl || `/images_ai/${serverResult.filename || item.file.name}`,
        fallbackUrl: serverResult.fallbackUrl || `/images/${serverResult.filename || item.file.name}`
      };

      const progressLabel = serverResult.isExactDuplicate
        ? 'Duplicate Deleted (Identical)'
        : serverResult.isDifferentShot
          ? 'Review Needed (Different Shot)'
          : 'Synced';

      this.updateItem(item.id, {
        status: 'success',
        uploadedUrl: newImageInfo.url,
        progressPercent: 100,
        chunkProgress: progressLabel,
        error: undefined
      });

      if (this.onGarmentImageUpdatedCb) {
        this.onGarmentImageUpdatedCb(item.garmentId, newImageInfo);
      }

      return true;
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || this.isCancelled || err?.message === 'Upload cancelled';
      const errorMsg = isAbort ? 'Upload cancelled' : (err?.message || 'Network error or timeout');

      this.updateItem(item.id, {
        status: 'failed',
        error: errorMsg,
        chunkProgress: 'Interrupted (Resumable)'
      });
      return false;
    }
  }
}
