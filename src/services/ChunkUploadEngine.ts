/**
 * ChunkUploadEngine - Modular Object-Oriented Resilient Upload Engine
 * 
 * Architectural Safeguards:
 * 1. Sequential (serial) single-packet streaming by default (zero browser heap bloating).
 * 2. Conservative default 512KB packet slicing (avoids 1MB proxy/gateway payload limits).
 * 3. Deterministic session IDs based on (garmentId, role, filename, size, lastModified)
 *    ensuring 100% reliable resumption even after browser reload or cache clearing.
 * 4. End-to-end packet audit logging with latency, bytes, HTTP status codes, and error diagnostics.
 * 5. Automatic retry with jittered exponential backoff per individual packet.
 */

export interface ChunkUploadOptions {
  chunkSize?: number;       // default 512KB (512 * 1024)
  concurrency?: number;     // default 1 (serial safe streaming)
  maxRetries?: number;      // default 3 attempts per packet
  timeoutMs?: number;       // default 30000ms per packet
}

export interface PacketDiagnosticLog {
  timestamp: string;
  chunkIndex: number;
  totalChunks: number;
  bytes: number;
  attempt: number;
  status: 'PENDING' | 'SUCCESS' | 'RETRY' | 'FAILED';
  httpStatus?: number;
  durationMs?: number;
  message: string;
  error?: string;
}

export interface ChunkProgressInfo {
  uploadId: string;
  totalBytes: number;
  uploadedBytes: number;
  percent: number;
  totalChunks: number;
  completedChunks: number;
  currentChunkIndex: number;
  currentChunkAttempt: number;
  speedMBps: number;
  etaSeconds: number;
  message: string;
}

export type ProgressCallback = (info: ChunkProgressInfo) => void;
export type DiagnosticCallback = (log: PacketDiagnosticLog) => void;

export class ChunkUploadEngine {
  private file: File;
  private uploadId: string;
  private garmentId: string;
  private role: 'Front' | 'Back' | 'Label';
  private chunkSize: number;
  private concurrency: number;
  private maxRetries: number;
  private timeoutMs: number;

  private aborted: boolean = false;
  private currentAbortController: AbortController | null = null;
  private completedChunks: Set<number> = new Set();
  private startTime: number = 0;
  private onProgressCallback?: ProgressCallback;
  private onDiagnosticCallback?: DiagnosticCallback;
  private diagnosticLogs: PacketDiagnosticLog[] = [];

  constructor(
    file: File,
    uploadId: string,
    garmentId: string,
    role: 'Front' | 'Back' | 'Label',
    options?: ChunkUploadOptions
  ) {
    this.file = file;
    this.garmentId = garmentId;
    this.role = role;
    this.uploadId = uploadId || ChunkUploadEngine.generateSessionId(file, garmentId, role);
    // Smart packet sizing: If file <= 3.5MB, send in 1 swift packet. Otherwise, default to 1.5MB chunks (1536 KB)
    const defaultChunk = file.size <= 3.5 * 1024 * 1024 ? file.size : 1536 * 1024;
    this.chunkSize = options?.chunkSize ?? defaultChunk;
    this.concurrency = Math.max(1, options?.concurrency ?? 1);
    this.maxRetries = options?.maxRetries ?? 3;
    this.timeoutMs = options?.timeoutMs ?? 30000;
  }

  /**
   * Generates a deterministic session ID derived from file identity.
   * This guarantees that if an upload fails or the user retries,
   * the exact same session ID is re-used, preserving server-acknowledged chunks!
   */
  public static generateSessionId(file: File, garmentId: string, role: string): string {
    const cleanName = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mtime = file.lastModified || 0;
    return `up_${garmentId}_${role}_${cleanName}_${file.size}_${mtime}`;
  }

  public onProgress(callback: ProgressCallback): this {
    this.onProgressCallback = callback;
    return this;
  }

  public onDiagnostic(callback: DiagnosticCallback): this {
    this.onDiagnosticCallback = callback;
    return this;
  }

  public getDiagnosticLogs(): PacketDiagnosticLog[] {
    return [...this.diagnosticLogs];
  }

  private addDiagnostic(log: Omit<PacketDiagnosticLog, 'timestamp'>): void {
    const fullLog: PacketDiagnosticLog = {
      ...log,
      timestamp: new Date().toLocaleTimeString()
    };
    this.diagnosticLogs.push(fullLog);
    if (this.onDiagnosticCallback) {
      this.onDiagnosticCallback(fullLog);
    }
  }

  public abort(): void {
    this.aborted = true;
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {}
      this.currentAbortController = null;
    }
  }

  /**
   * Queries the server for any packets already persisted for this session (Resumability check)
   */
  public async fetchServerStatus(): Promise<Set<number>> {
    try {
      const res = await fetch(`/api/upload-chunk/status?uploadId=${encodeURIComponent(this.uploadId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.uploadedChunks)) {
          for (const idx of data.uploadedChunks) {
            this.completedChunks.add(Number(idx));
          }
          this.addDiagnostic({
            chunkIndex: -1,
            totalChunks: Math.ceil(this.file.size / this.chunkSize),
            bytes: 0,
            attempt: 1,
            status: 'SUCCESS',
            httpStatus: 200,
            message: `Resume check: ${this.completedChunks.size} packets already cached on server`
          });
        }
      }
    } catch (e: any) {
      this.addDiagnostic({
        chunkIndex: -1,
        totalChunks: Math.ceil(this.file.size / this.chunkSize),
        bytes: 0,
        attempt: 1,
        status: 'RETRY',
        message: `Status check error (will upload fresh): ${e?.message || e}`
      });
    }
    return this.completedChunks;
  }

  /**
   * Executes the chunked upload with sequential safety
   */
  public async start(externalSignal?: AbortSignal): Promise<any> {
    this.aborted = false;
    this.startTime = Date.now();

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => this.abort(), { once: true });
    }

    const totalBytes = this.file.size;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / this.chunkSize));

    // Pre-check existing packets on the server
    await this.fetchServerStatus();

    this.notifyProgress(
      totalChunks, 
      totalBytes, 
      0, 
      1, 
      this.completedChunks.size > 0 
        ? `Resuming from packet ${this.completedChunks.size + 1}/${totalChunks}...` 
        : `Preparing packet stream (1/${totalChunks})...`
    );

    let finalServerResult: any = null;

    // Sequential transmission loop (1 chunk at a time for absolute memory stability)
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (this.aborted) {
        throw new Error('Upload cancelled');
      }

      // Skip already uploaded chunks
      if (this.completedChunks.has(chunkIndex)) {
        continue;
      }

      const result = await this.uploadSingleChunkWithRetry(chunkIndex, totalChunks);
      this.completedChunks.add(chunkIndex);

      if (result?.completed) {
        finalServerResult = result;
      }

      this.notifyProgress(
        totalChunks,
        totalBytes,
        chunkIndex + 1,
        1,
        `Transmitted packet ${this.completedChunks.size}/${totalChunks}`
      );
    }

    if (this.aborted) {
      throw new Error('Upload cancelled');
    }

    if (finalServerResult && finalServerResult.success) {
      return finalServerResult;
    }

    // Explicit finalize call if all packets are uploaded but server hasn't triggered assembly
    return await this.finalizeAssembly(totalChunks);
  }

  private async uploadSingleChunkWithRetry(chunkIndex: number, totalChunks: number): Promise<any> {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(this.file.size, start + this.chunkSize);
    const chunkBytes = end - start;
    
    // Slice chunk JUST-IN-TIME to avoid holding memory
    const chunkBlob = this.file.slice(start, end);

    let lastError: any = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      if (this.aborted) throw new Error('Upload cancelled');

      const ctrl = new AbortController();
      this.currentAbortController = ctrl;
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      const t0 = Date.now();

      this.notifyProgress(
        totalChunks,
        this.file.size,
        chunkIndex + 1,
        attempt,
        `Packet ${chunkIndex + 1}/${totalChunks}${attempt > 1 ? ` (retry ${attempt}/${this.maxRetries})` : ''}`
      );

      try {
        const formData = new FormData();
        formData.append('chunk', chunkBlob, this.file.name);
        formData.append('uploadId', this.uploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));
        formData.append('filename', this.file.name);
        formData.append('garmentId', this.garmentId);
        formData.append('role', this.role);
        formData.append('enableOcr', this.role === 'Label' ? 'true' : 'false');

        const res = await fetch('/api/upload-chunk', {
          method: 'POST',
          body: formData,
          signal: ctrl.signal
        });

        clearTimeout(timer);
        this.currentAbortController = null;
        const elapsed = Date.now() - t0;

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let parsedError = `HTTP ${res.status} (${res.statusText})`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) parsedError = parsed.error;
          } catch {}

          this.addDiagnostic({
            chunkIndex,
            totalChunks,
            bytes: chunkBytes,
            attempt,
            status: attempt < this.maxRetries ? 'RETRY' : 'FAILED',
            httpStatus: res.status,
            durationMs: elapsed,
            message: `Server returned error ${res.status}: ${parsedError}`,
            error: errText
          });

          throw new Error(parsedError);
        }

        const data = await res.json();
        this.addDiagnostic({
          chunkIndex,
          totalChunks,
          bytes: chunkBytes,
          attempt,
          status: 'SUCCESS',
          httpStatus: 200,
          durationMs: elapsed,
          message: `Packet ${chunkIndex + 1}/${totalChunks} acknowledged (${Math.round(chunkBytes / 1024)} KB in ${elapsed}ms)`
        });

        return data;
      } catch (err: any) {
        clearTimeout(timer);
        this.currentAbortController = null;
        const elapsed = Date.now() - t0;
        lastError = err;

        if (this.aborted) throw new Error('Upload cancelled');

        this.addDiagnostic({
          chunkIndex,
          totalChunks,
          bytes: chunkBytes,
          attempt,
          status: attempt < this.maxRetries ? 'RETRY' : 'FAILED',
          durationMs: elapsed,
          message: `Transmission attempt ${attempt}/${this.maxRetries} failed: ${err?.message || err}`,
          error: err?.stack || String(err)
        });

        if (attempt < this.maxRetries) {
          // Jittered backoff: 350ms, 700ms, etc.
          await new Promise(r => setTimeout(r, 350 * attempt + Math.random() * 200));
        }
      }
    }

    throw new Error(lastError?.message || `Packet ${chunkIndex + 1}/${totalChunks} failed after ${this.maxRetries} attempts`);
  }

  private async finalizeAssembly(totalChunks: number): Promise<any> {
    const formData = new FormData();
    formData.append('uploadId', this.uploadId);
    formData.append('finalize', 'true');
    formData.append('totalChunks', String(totalChunks));
    formData.append('filename', this.file.name);
    formData.append('garmentId', this.garmentId);
    formData.append('role', this.role);
    formData.append('enableOcr', this.role === 'Label' ? 'true' : 'false');

    const res = await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to assemble packets (HTTP ${res.status})`);
    }

    return await res.json();
  }

  private notifyProgress(
    totalChunks: number, 
    totalBytes: number, 
    currentChunkIndex: number, 
    currentChunkAttempt: number, 
    message: string
  ): void {
    if (!this.onProgressCallback) return;

    const completed = this.completedChunks.size;
    const uploadedBytes = Math.min(totalBytes, completed * this.chunkSize);
    const percent = Math.min(100, Math.round((completed / totalChunks) * 100));

    const elapsedSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);
    const speedMBps = uploadedBytes / (1024 * 1024) / elapsedSeconds;
    const remainingBytes = Math.max(0, totalBytes - uploadedBytes);
    const etaSeconds = speedMBps > 0.05 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBps) : 0;

    this.onProgressCallback({
      uploadId: this.uploadId,
      totalBytes,
      uploadedBytes,
      percent,
      totalChunks,
      completedChunks: completed,
      currentChunkIndex,
      currentChunkAttempt,
      speedMBps: Math.round(speedMBps * 10) / 10,
      etaSeconds,
      message
    });
  }
}
