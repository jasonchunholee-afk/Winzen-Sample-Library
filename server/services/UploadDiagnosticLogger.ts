import fs from 'fs';
import path from 'path';

export interface UploadLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  uploadId: string;
  stage: 
    | 'session_status_query'
    | 'chunk_received'
    | 'chunk_saved'
    | 'assembly_started'
    | 'reassembled_to_disk'
    | 'image_processed'
    | 'session_cleaned'
    | 'error';
  filename?: string;
  garmentId?: string;
  role?: string;
  chunkIndex?: number;
  totalChunks?: number;
  bytes?: number;
  durationMs?: number;
  message: string;
  error?: string;
  memoryMB: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export class UploadDiagnosticLogger {
  private static instance: UploadDiagnosticLogger;
  private logFilePath: string;
  private memoryLogs: UploadLogEntry[] = [];
  private maxMemoryEntries: number = 500;

  private constructor() {
    const logsDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, 'upload_diagnostic.log');
  }

  public static getInstance(): UploadDiagnosticLogger {
    if (!UploadDiagnosticLogger.instance) {
      UploadDiagnosticLogger.instance = new UploadDiagnosticLogger();
    }
    return UploadDiagnosticLogger.instance;
  }

  private getMemoryStats() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10
    };
  }

  public record(entry: Omit<UploadLogEntry, 'id' | 'timestamp' | 'memoryMB'>): UploadLogEntry {
    const fullEntry: UploadLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      memoryMB: this.getMemoryStats()
    };

    // Append to in-memory buffer
    this.memoryLogs.push(fullEntry);
    if (this.memoryLogs.length > this.maxMemoryEntries) {
      this.memoryLogs.shift();
    }

    // Append to file on disk for persistent post-mortem analysis
    try {
      const line = `[${fullEntry.timestamp}] [${fullEntry.level}] [${fullEntry.uploadId}] [${fullEntry.stage}] ` +
        `${fullEntry.chunkIndex !== undefined ? `Chunk ${fullEntry.chunkIndex + 1}/${fullEntry.totalChunks} ` : ''}` +
        `${fullEntry.bytes ? `(${Math.round(fullEntry.bytes / 1024)}KB) ` : ''}` +
        `${fullEntry.durationMs ? `took ${fullEntry.durationMs}ms ` : ''}` +
        `RAM:${fullEntry.memoryMB.heapUsed}MB - ${fullEntry.message}` +
        `${fullEntry.error ? ` ERROR: ${fullEntry.error}` : ''}\n`;
      fs.appendFileSync(this.logFilePath, line, 'utf8');
    } catch (e) {
      console.error('[UploadDiagnosticLogger] Disk write failed:', e);
    }

    if (fullEntry.level === 'ERROR') {
      console.error(`[UploadDiagnostic] ${fullEntry.message}`, fullEntry.error || '');
    } else if (fullEntry.level === 'WARN') {
      console.warn(`[UploadDiagnostic] ${fullEntry.message}`);
    }

    return fullEntry;
  }

  public log(entry: Omit<UploadLogEntry, 'id' | 'timestamp' | 'memoryMB'>): UploadLogEntry {
    return this.record(entry);
  }

  public getRecentLogs(uploadId?: string, limit: number = 100): UploadLogEntry[] {
    return this.getLogs(uploadId, limit);
  }

  public getRawLog(): string {
    return this.getRawLogText();
  }

  public clear(): void {
    this.clearLogs();
  }

  public getLogs(uploadId?: string, limit: number = 100): UploadLogEntry[] {
    let filtered = this.memoryLogs;
    if (uploadId) {
      filtered = filtered.filter(l => l.uploadId === uploadId);
    }
    return filtered.slice(-limit).reverse();
  }

  public clearLogs(): void {
    this.memoryLogs = [];
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, `=== Upload Diagnostic Log Cleared ${new Date().toISOString()} ===\n`, 'utf8');
      }
    } catch {}
  }

  public getRawLogText(): string {
    try {
      if (fs.existsSync(this.logFilePath)) {
        return fs.readFileSync(this.logFilePath, 'utf8');
      }
    } catch {}
    return 'No log file found.';
  }
}
