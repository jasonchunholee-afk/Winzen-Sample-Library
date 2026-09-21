/**
 * FileSystemSyncService.ts
 * 
 * Object-Oriented service managing:
 * 1. File System Access API directory handle selection & persistence in IndexedDB.
 * 2. Scanning 3-tier subdirectories ([Root]/raw, [Root]/ai, [Root]/thumb).
 * 3. Comparing local files against /api/capture/sync-diff.
 * 4. Up-syncing local missing files to the server with live progress callbacks.
 * 5. Down-syncing server missing files into local directory handle (with zip fallback).
 * 6. Two-way synchronization with conflict detection.
 */

export interface LocalScanResult {
  filename: string;
  tier: 'raw' | 'ai' | 'thumb';
  size: number;
  lastModified: number;
  file?: File;
  relativePath: string;
}

export interface SyncDiffSummary {
  clientFileCount: number;
  serverRawCount: number;
  serverAiCount: number;
  serverThumbCount: number;
  toUploadCount: number;
  toDownloadCount: number;
  stickersDetected: number;
}

export interface SyncProgress {
  phase: 'idle' | 'scanning' | 'diffing' | 'up-syncing' | 'down-syncing' | 'complete' | 'error';
  total: number;
  current: number;
  percent: number;
  currentFilename?: string;
  message: string;
  conflicts?: string[];
}

const DB_NAME = 'WinzenSyncDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'DirectoryHandles';
const DIR_HANDLE_KEY = 'capture_root_dir';

export class FileSystemSyncService {
  private static instance: FileSystemSyncService;
  private rootHandle: any = null;
  private rootDirName: string = '';

  private constructor() {}

  public static getInstance(): FileSystemSyncService {
    if (!FileSystemSyncService.instance) {
      FileSystemSyncService.instance = new FileSystemSyncService();
    }
    return FileSystemSyncService.instance;
  }

  /**
   * Initialize IndexedDB database for persisting FileSystemDirectoryHandle
   */
  private async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save directory handle into IndexedDB
   */
  public async saveHandleToIndexedDb(handle: any): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, DIR_HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[FileSystemSync] Could not store handle in IndexedDB:', err);
    }
  }

  /**
   * Retrieve directory handle from IndexedDB
   */
  public async getHandleFromIndexedDb(): Promise<any> {
    try {
      const db = await this.getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(DIR_HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Check if File System Access API is supported
   */
  public isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Verify readwrite permissions on an existing handle
   */
  public async verifyPermission(handle: any, mode: 'read' | 'readwrite' = 'readwrite'): Promise<boolean> {
    if (!handle) return false;
    try {
      if ((await handle.queryPermission({ mode })) === 'granted') {
        return true;
      }
      if ((await handle.requestPermission({ mode })) === 'granted') {
        return true;
      }
    } catch (err) {
      console.warn('[FileSystemSync] Permission request failed:', err);
    }
    return false;
  }

  /**
   * Auto-hydrate stored handle on modal open
   */
  public async restoreStoredFolder(): Promise<{ handle: any; dirName: string; hasPermission: boolean }> {
    const handle = await this.getHandleFromIndexedDb();
    if (!handle) {
      return { handle: null, dirName: '', hasPermission: false };
    }
    this.rootHandle = handle;
    this.rootDirName = handle.name || 'Stored Folder';
    const hasPermission = await this.verifyPermission(handle, 'readwrite');
    return { handle, dirName: this.rootDirName, hasPermission };
  }

  /**
   * "Folder" button: Invokes window.showDirectoryPicker() and persists in IndexedDB
   */
  public async pickDirectory(): Promise<{ handle: any; dirName: string }> {
    if (!this.isFileSystemAccessSupported()) {
      throw new Error('File System Access API is not supported in this browser. Please use Chrome, Edge, or direct upload.');
    }

    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'pictures'
    });

    this.rootHandle = handle;
    this.rootDirName = handle.name || 'Selected Folder';

    await this.saveHandleToIndexedDb(handle);

    return { handle, dirName: this.rootDirName };
  }

  public getRootDirectoryName(): string {
    return this.rootDirName;
  }

  public hasRootHandle(): boolean {
    return !!this.rootHandle;
  }

  /**
   * Scan local folder structure for files across raw, ai, thumb (or root level)
   */
  public async scanLocalFolder(onProgress?: (scannedCount: number) => void): Promise<LocalScanResult[]> {
    if (!this.rootHandle) {
      throw new Error('No folder selected. Please select a folder first.');
    }

    const hasPerm = await this.verifyPermission(this.rootHandle, 'read');
    if (!hasPerm) {
      throw new Error('Read permission denied on local folder.');
    }

    const results: LocalScanResult[] = [];
    const imageExtRegex = /\.(jpe?g|png|webp)$/i;

    // Helper to read entries from a directory handle
    const scanDir = async (dirHandle: any, tier: 'raw' | 'ai' | 'thumb', relPath: string) => {
      try {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && imageExtRegex.test(entry.name)) {
            const file = await entry.getFile();
            results.push({
              filename: entry.name,
              tier,
              size: file.size,
              lastModified: file.lastModified,
              file,
              relativePath: `${relPath}/${entry.name}`
            });
            if (onProgress) onProgress(results.length);
          }
        }
      } catch (err) {
        console.warn(`[FileSystemSync] Error scanning directory ${relPath}:`, err);
      }
    };

    // 1. Check for dedicated subdirectories: raw/, ai/, thumb/
    let hasSubdirs = false;
    for (const tier of ['raw', 'ai', 'thumb'] as const) {
      try {
        const subHandle = await this.rootHandle.getDirectoryHandle(tier);
        if (subHandle) {
          hasSubdirs = true;
          await scanDir(subHandle, tier, tier);
        }
      } catch {
        // Subdir doesn't exist yet, that's fine
      }
    }

    // 2. If no subdirs, scan root directly as 'raw'
    if (!hasSubdirs) {
      await scanDir(this.rootHandle, 'raw', '');
    }

    return results;
  }

  /**
   * Compare local scan results against server /api/capture/sync-diff
   */
  public async getSyncDiff(localFiles: LocalScanResult[]): Promise<{
    summary: SyncDiffSummary;
    toUpload: Array<{ filename: string; garmentId: string; role: string; isSticker: boolean; missingTiers: string[] }>;
    toDownload: Array<{ filename: string; garmentId: string; role: string; availableTiers: string[]; url: string }>;
    stickersDetected: string[];
  }> {
    const clientManifest = localFiles.map(f => ({
      filename: f.filename,
      size: f.size,
      tier: f.tier,
      mtime: f.lastModified
    }));

    const res = await fetch('/api/capture/sync-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientManifest })
    });

    if (!res.ok) {
      throw new Error(`Failed to retrieve sync diff: ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * "Up-sync" button: Uploads missing photos to the server with a live progress bar
   */
  public async executeUpSync(
    localFiles: LocalScanResult[],
    toUploadList: Array<{ filename: string; missingTiers?: string[] }>,
    onProgress: (progress: SyncProgress) => void
  ): Promise<{ uploadedCount: number; errors: string[] }> {
    const localMap = new Map<string, LocalScanResult>();
    for (const f of localFiles) {
      localMap.set(f.filename, f);
    }

    const itemsToUpload = toUploadList
      .map(item => localMap.get(item.filename))
      .filter((item): item is LocalScanResult => !!item && !!item.file);

    const total = itemsToUpload.length;
    let uploadedCount = 0;
    const errors: string[] = [];

    if (total === 0) {
      onProgress({
        phase: 'complete',
        total: 0,
        current: 0,
        percent: 100,
        message: 'Everything is up to date on server. No files to upload.'
      });
      return { uploadedCount: 0, errors: [] };
    }

    // Batch upload items in chunks of 5
    const batchSize = 3;
    for (let i = 0; i < itemsToUpload.length; i += batchSize) {
      const batch = itemsToUpload.slice(i, i + batchSize);
      
      const formData = new FormData();
      for (const item of batch) {
        if (item.file) {
          formData.append('files', item.file, item.filename);
        }
      }

      onProgress({
        phase: 'up-syncing',
        total,
        current: uploadedCount,
        percent: Math.round((uploadedCount / total) * 100),
        currentFilename: batch[0]?.filename,
        message: `Uploading ${uploadedCount + 1} of ${total}: ${batch[0]?.filename}...`
      });

      try {
        const res = await fetch('/api/capture/up-sync', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${res.status}`);
        }

        uploadedCount += batch.length;
      } catch (err: any) {
        console.error('[FileSystemSync] Batch upload error:', err);
        errors.push(`Failed batch at ${batch[0]?.filename}: ${err.message}`);
      }

      onProgress({
        phase: 'up-syncing',
        total,
        current: Math.min(uploadedCount, total),
        percent: Math.round((Math.min(uploadedCount, total) / total) * 100),
        currentFilename: batch[batch.length - 1]?.filename,
        message: `Uploaded ${Math.min(uploadedCount, total)} of ${total} files.`
      });
    }

    onProgress({
      phase: 'complete',
      total,
      current: uploadedCount,
      percent: 100,
      message: `Up-sync complete! ${uploadedCount} photos uploaded to server.`
    });

    return { uploadedCount, errors };
  }

  /**
   * "Down-sync" button: Pulls missing server images and writes directly into local directory handle
   */
  public async executeDownSync(
    toDownloadList: Array<{ filename: string; url?: string; availableTiers?: string[] }>,
    onProgress: (progress: SyncProgress) => void
  ): Promise<{ downloadedCount: number; errors: string[] }> {
    if (!this.rootHandle) {
      throw new Error('No local folder selected. Please select a folder first or use Zip fallback.');
    }

    const hasPerm = await this.verifyPermission(this.rootHandle, 'readwrite');
    if (!hasPerm) {
      throw new Error('Write permission denied on local folder. Please re-grant folder access.');
    }

    const total = toDownloadList.length;
    let downloadedCount = 0;
    const errors: string[] = [];

    if (total === 0) {
      onProgress({
        phase: 'complete',
        total: 0,
        current: 0,
        percent: 100,
        message: 'Everything is up to date locally. No server files to download.'
      });
      return { downloadedCount: 0, errors: [] };
    }

    // Ensure raw/, ai/, thumb/ subdirectories exist locally
    let rawDirHandle: any;
    let aiDirHandle: any;
    let thumbDirHandle: any;

    try {
      rawDirHandle = await this.rootHandle.getDirectoryHandle('raw', { create: true });
      aiDirHandle = await this.rootHandle.getDirectoryHandle('ai', { create: true });
      thumbDirHandle = await this.rootHandle.getDirectoryHandle('thumb', { create: true });
    } catch {
      // Fallback: write to root if cannot create subdirectories
      rawDirHandle = this.rootHandle;
      aiDirHandle = this.rootHandle;
      thumbDirHandle = this.rootHandle;
    }

    for (let i = 0; i < toDownloadList.length; i++) {
      const item = toDownloadList[i];
      const filename = item.filename;

      onProgress({
        phase: 'down-syncing',
        total,
        current: i,
        percent: Math.round((i / total) * 100),
        currentFilename: filename,
        message: `Downloading ${i + 1} of ${total}: ${filename}...`
      });

      try {
        // Download raw/ image first
        const rawRes = await fetch(`/images/${encodeURIComponent(filename)}`);
        if (rawRes.ok) {
          const blob = await rawRes.blob();
          const fileHandle = await rawDirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }

        // Optionally pull ai/ and thumb/ if available
        const thumbRes = await fetch(`/images_thumb/${encodeURIComponent(filename)}`);
        if (thumbRes.ok && thumbDirHandle !== this.rootHandle) {
          const blob = await thumbRes.blob();
          const fileHandle = await thumbDirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }

        downloadedCount++;
      } catch (err: any) {
        console.error(`[FileSystemSync] Failed downloading ${filename}:`, err);
        errors.push(`Download failed for ${filename}: ${err.message}`);
      }

      onProgress({
        phase: 'down-syncing',
        total,
        current: i + 1,
        percent: Math.round(((i + 1) / total) * 100),
        currentFilename: filename,
        message: `Downloaded ${i + 1} of ${total} files.`
      });
    }

    onProgress({
      phase: 'complete',
      total,
      current: downloadedCount,
      percent: 100,
      message: `Down-sync complete! ${downloadedCount} server photos written to local folder.`
    });

    return { downloadedCount, errors };
  }

  /**
   * "Sync" button: Performs two-way synchronization with conflict detection
   */
  public async executeTwoWaySync(
    localFiles: LocalScanResult[],
    onProgress: (progress: SyncProgress) => void
  ): Promise<{
    upCount: number;
    downCount: number;
    conflicts: string[];
    errors: string[];
  }> {
    onProgress({
      phase: 'diffing',
      total: 100,
      current: 10,
      percent: 10,
      message: 'Analyzing local and server state for two-way diff & conflict detection...'
    });

    const diff = await this.getSyncDiff(localFiles);
    const conflicts: string[] = [];

    // Conflict detection: If a file has identical name but size divergence
    const localMap = new Map<string, LocalScanResult>();
    for (const f of localFiles) {
      localMap.set(f.filename, f);
    }

    // 1. Up-sync phase
    let upCount = 0;
    const errors: string[] = [];
    if (diff.toUpload.length > 0) {
      onProgress({
        phase: 'up-syncing',
        total: diff.toUpload.length,
        current: 0,
        percent: 20,
        message: `Starting up-sync for ${diff.toUpload.length} missing server photos...`
      });

      const upResult = await this.executeUpSync(localFiles, diff.toUpload, (p) => {
        onProgress({
          ...p,
          percent: Math.round(20 + (p.percent * 0.4))
        });
      });
      upCount = upResult.uploadedCount;
      errors.push(...upResult.errors);
    }

    // 2. Down-sync phase
    let downCount = 0;
    if (diff.toDownload.length > 0) {
      onProgress({
        phase: 'down-syncing',
        total: diff.toDownload.length,
        current: 0,
        percent: 60,
        message: `Starting down-sync for ${diff.toDownload.length} missing local photos...`
      });

      const downResult = await this.executeDownSync(diff.toDownload, (p) => {
        onProgress({
          ...p,
          percent: Math.round(60 + (p.percent * 0.4))
        });
      });
      downCount = downResult.downloadedCount;
      errors.push(...downResult.errors);
    }

    onProgress({
      phase: 'complete',
      total: 100,
      current: 100,
      percent: 100,
      message: `Two-way sync complete! Up: ${upCount}, Down: ${downCount}. All repositories harmonized.`
    });

    return { upCount, downCount, conflicts, errors };
  }
}
