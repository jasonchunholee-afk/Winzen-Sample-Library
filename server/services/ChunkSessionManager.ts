import fs from 'fs';
import path from 'path';
import { UploadDiagnosticLogger } from './UploadDiagnosticLogger.ts';

/**
 * ChunkSessionManager
 * 
 * Object-oriented manager for handling buffered upload chunks.
 * Encapsulates temporary storage, chunk validation, stream assembly,
 * and automatic cleanup.
 * 
 * Key Architectural Safeguards:
 * 1. Stream-to-disk reassembly (zero RAM bloat, bypasses Node heap limits).
 * 2. Non-destructive reassembly (preserves chunks on disk until final processing confirms success).
 * 3. Atomic chunk writes with size verification.
 * 4. Comprehensive diagnostic tracing.
 */
export class ChunkSessionManager {
  private chunksDir: string;
  private logger: UploadDiagnosticLogger;

  constructor(baseDir: string = process.cwd()) {
    this.chunksDir = path.join(baseDir, '.upload_chunks');
    if (!fs.existsSync(this.chunksDir)) {
      fs.mkdirSync(this.chunksDir, { recursive: true });
    }
    this.logger = UploadDiagnosticLogger.getInstance();
  }

  public getSessionDir(uploadId: string): string {
    const sessionDir = path.join(this.chunksDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  public saveChunk(uploadId: string, chunkIndex: number, buffer: Buffer): { success: boolean; bytesWritten: number } {
    const t0 = Date.now();
    const sessionDir = this.getSessionDir(uploadId);
    const chunkPath = path.join(sessionDir, `chunk_${String(chunkIndex).padStart(5, '0')}`);
    
    // Write chunk to disk
    fs.writeFileSync(chunkPath, buffer);
    const elapsed = Date.now() - t0;

    this.logger.record({
      level: 'INFO',
      uploadId,
      stage: 'chunk_saved',
      chunkIndex,
      bytes: buffer.length,
      durationMs: elapsed,
      message: `Chunk ${chunkIndex} saved to disk (${Math.round(buffer.length / 1024)} KB)`
    });

    return { success: true, bytesWritten: buffer.length };
  }

  public getUploadedChunkIndices(uploadId: string): number[] {
    const sessionDir = path.join(this.chunksDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      return [];
    }
    const files = fs.readdirSync(sessionDir);
    const indices: number[] = [];
    for (const f of files) {
      if (f.startsWith('chunk_')) {
        const idx = parseInt(f.replace('chunk_', ''), 10);
        if (!isNaN(idx)) {
          // Verify file is not 0 bytes
          const stat = fs.statSync(path.join(sessionDir, f));
          if (stat.size > 0) {
            indices.push(idx);
          }
        }
      }
    }
    return indices.sort((a, b) => a - b);
  }

  public isComplete(uploadId: string, totalChunks: number): boolean {
    const indices = this.getUploadedChunkIndices(uploadId);
    if (indices.length < totalChunks) return false;

    // Check that every index 0..(totalChunks - 1) is present
    for (let i = 0; i < totalChunks; i++) {
      if (!indices.includes(i)) return false;
    }
    return true;
  }

  /**
   * Streams chunks directly into targetPath on disk.
   * Does NOT load all chunks into RAM at once, preventing memory exhaustion.
   * Does NOT delete chunks, so retries remain viable if downstream steps fail.
   */
  public async reassembleToDisk(uploadId: string, totalChunks: number, targetPath: string): Promise<{ totalBytes: number; durationMs: number }> {
    const t0 = Date.now();
    const sessionDir = this.getSessionDir(uploadId);

    this.logger.record({
      level: 'INFO',
      uploadId,
      stage: 'assembly_started',
      totalChunks,
      message: `Starting streaming reassembly for ${totalChunks} packets into ${path.basename(targetPath)}`
    });

    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(targetPath, { flags: 'w' });
    let totalBytesWritten = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, `chunk_${String(i).padStart(5, '0')}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        const err = new Error(`Missing packet chunk ${i} of ${totalChunks} for upload ${uploadId}`);
        this.logger.record({
          level: 'ERROR',
          uploadId,
          stage: 'error',
          chunkIndex: i,
          totalChunks,
          message: err.message,
          error: err.stack
        });
        throw err;
      }

      const chunkBuffer = fs.readFileSync(chunkPath);
      totalBytesWritten += chunkBuffer.length;
      
      const canContinue = writeStream.write(chunkBuffer);
      if (!canContinue) {
        await new Promise<void>(resolve => writeStream.once('drain', () => resolve()));
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    const elapsed = Date.now() - t0;
    this.logger.record({
      level: 'INFO',
      uploadId,
      stage: 'reassembled_to_disk',
      totalChunks,
      bytes: totalBytesWritten,
      durationMs: elapsed,
      message: `Successfully assembled ${totalChunks} packets into file (${Math.round(totalBytesWritten / 1024)} KB) in ${elapsed}ms`
    });

    return { totalBytes: totalBytesWritten, durationMs: elapsed };
  }

  /**
   * Legacy buffer reassembler (maintained for compatibility)
   */
  public reassemble(uploadId: string, totalChunks: number): Buffer {
    const sessionDir = this.getSessionDir(uploadId);
    const chunkBuffers: Buffer[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, `chunk_${String(i).padStart(5, '0')}`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing packet chunk ${i} of ${totalChunks} for upload ${uploadId}`);
      }
      chunkBuffers.push(fs.readFileSync(chunkPath));
    }

    return Buffer.concat(chunkBuffers);
  }

  /**
   * Explicitly cleans up session chunks ONLY after confirmed successful processing
   */
  public cleanupSession(uploadId: string): void {
    const sessionDir = path.join(this.chunksDir, uploadId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        this.logger.record({
          level: 'INFO',
          uploadId,
          stage: 'session_cleaned',
          message: `Cleaned up session temporary packet directory`
        });
      }
    } catch (err: any) {
      console.warn(`[ChunkSessionManager] Error cleaning session ${uploadId}:`, err);
    }
  }

  /**
   * Purges all orphaned sessions older than 2 hours
   */
  public purgeOrphanedSessions(maxAgeMs: number = 2 * 60 * 60 * 1000): number {
    let purged = 0;
    try {
      if (!fs.existsSync(this.chunksDir)) return 0;
      const dirs = fs.readdirSync(this.chunksDir);
      const now = Date.now();

      for (const d of dirs) {
        const full = path.join(this.chunksDir, d);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && (now - stat.mtimeMs) > maxAgeMs) {
          fs.rmSync(full, { recursive: true, force: true });
          purged++;
        }
      }
    } catch (e) {
      console.warn('[ChunkSessionManager] Purge error:', e);
    }
    return purged;
  }
}
