import React, { useState, useEffect } from 'react';
import { 
  Folder, ArrowUpCircle, ArrowDownCircle, RefreshCw, CheckCircle2, 
  AlertCircle, Download, FileCheck, Layers, HardDrive, ShieldCheck, Zap
} from 'lucide-react';
import { 
  FileSystemSyncService, LocalScanResult, SyncProgress, SyncDiffSummary 
} from '../../services/FileSystemSyncService';

interface FolderSyncTabProps {
  onSyncComplete?: () => void;
}

export function FolderSyncTab({ onSyncComplete }: FolderSyncTabProps) {
  const syncService = FileSystemSyncService.getInstance();

  const [dirName, setDirName] = useState<string>('');
  const [hasHandle, setHasHandle] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [localFiles, setLocalFiles] = useState<LocalScanResult[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [diffSummary, setDiffSummary] = useState<SyncDiffSummary | null>(null);
  
  // Active Action and Progress state
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<'up' | 'down' | 'two-way' | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Restore stored directory handle from IndexedDB on mount
  useEffect(() => {
    let isMounted = true;
    syncService.restoreStoredFolder().then(({ handle, dirName: storedName, hasPermission: perm }) => {
      if (!isMounted) return;
      if (handle) {
        setDirName(storedName);
        setHasHandle(true);
        setHasPermission(perm);
        if (perm) {
          scanDirectory();
        }
      }
    });
    return () => { isMounted = false; };
  }, []);

  const addLog = (msg: string) => {
    setLogMessages(prev => [msg, ...prev].slice(0, 50));
  };

  // 1. "Folder" button: Pick directory & store in IndexedDB
  const handleSelectFolder = async () => {
    try {
      setIsScanning(true);
      const { handle, dirName: name } = await syncService.pickDirectory();
      setDirName(name);
      setHasHandle(true);
      setHasPermission(true);
      addLog(`Selected local root folder: ${name} (Persisted in IndexedDB)`);
      await scanDirectory();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`Folder selection failed: ${err.message}`);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Scan local directory
  const scanDirectory = async () => {
    setIsScanning(true);
    try {
      const files = await syncService.scanLocalFolder((count) => {
        // Optional scan count updates
      });
      setLocalFiles(files);
      addLog(`Scanned ${files.length} local images across raw, ai, and thumb subdirectories.`);

      // Compute initial diff
      if (files.length > 0) {
        const diff = await syncService.getSyncDiff(files);
        setDiffSummary(diff.summary);
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      addLog(`Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 2. "Up-sync" button
  const handleUpSync = async () => {
    if (localFiles.length === 0) {
      alert('Please select and scan a local folder containing photos first.');
      return;
    }

    setSyncing(true);
    setActiveAction('up');
    try {
      addLog('Initiating Up-sync: checking diff with server...');
      const diff = await syncService.getSyncDiff(localFiles);
      setDiffSummary(diff.summary);

      if (diff.toUpload.length === 0) {
        setProgress({
          phase: 'complete',
          total: 0,
          current: 0,
          percent: 100,
          message: 'Up to date: All local images already exist on the server!'
        });
        addLog('Up-sync: All local files are already uploaded.');
        return;
      }

      addLog(`Uploading ${diff.toUpload.length} missing photos to server...`);
      const res = await syncService.executeUpSync(localFiles, diff.toUpload, (p) => {
        setProgress(p);
        if (p.currentFilename) {
          addLog(`[Up-sync] Uploaded ${p.currentFilename} (${p.current}/${p.total})`);
        }
      });

      addLog(`Up-sync complete: ${res.uploadedCount} photos successfully sent.`);
      await scanDirectory();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('Up-sync failed:', err);
      addLog(`Up-sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
      setActiveAction(null);
    }
  };

  // 3. "Down-sync" button
  const handleDownSync = async () => {
    setSyncing(true);
    setActiveAction('down');
    try {
      addLog('Initiating Down-sync: querying server repository manifest...');
      const diff = await syncService.getSyncDiff(localFiles);
      setDiffSummary(diff.summary);

      if (diff.toDownload.length === 0) {
        setProgress({
          phase: 'complete',
          total: 0,
          current: 0,
          percent: 100,
          message: 'Up to date: Local folder contains all photos present on server!'
        });
        addLog('Down-sync: Local folder is fully populated with server photos.');
        return;
      }

      addLog(`Writing ${diff.toDownload.length} missing server photos into local directory...`);
      const res = await syncService.executeDownSync(diff.toDownload, (p) => {
        setProgress(p);
        if (p.currentFilename) {
          addLog(`[Down-sync] Saved ${p.currentFilename} locally (${p.current}/${p.total})`);
        }
      });

      addLog(`Down-sync complete: ${res.downloadedCount} server photos written to local disk.`);
      await scanDirectory();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('Down-sync failed:', err);
      addLog(`Down-sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
      setActiveAction(null);
    }
  };

  // 4. "Sync" button (Two-way synchronization)
  const handleTwoWaySync = async () => {
    setSyncing(true);
    setActiveAction('two-way');
    try {
      addLog('Initiating Two-way Harmonization: evaluating local & server files...');
      const res = await syncService.executeTwoWaySync(localFiles, (p) => {
        setProgress(p);
      });

      addLog(`Two-way Sync Completed: ${res.upCount} uploaded, ${res.downCount} downloaded.`);
      if (res.conflicts.length > 0) {
        addLog(`Notice: ${res.conflicts.length} files had size variations.`);
      }
      await scanDirectory();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('Two-way sync failed:', err);
      addLog(`Two-way sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
      setActiveAction(null);
    }
  };

  // Download fallback zip
  const handleDownloadZip = () => {
    window.open('/api/capture/down-sync-zip?tier=all', '_blank');
  };

  const rawCount = localFiles.filter(f => f.tier === 'raw').length;
  const aiCount = localFiles.filter(f => f.tier === 'ai').length;
  const thumbCount = localFiles.filter(f => f.tier === 'thumb').length;

  return (
    <div className="space-y-6">
      {/* Folder Control Card */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-neutral-900 text-sm">
                  {hasHandle ? dirName : 'No Local Folder Linked'}
                </h4>
                {hasHandle && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    IndexedDB Persisted
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {hasHandle 
                  ? `Root folder containing raw/, ai/, and thumb/ directories (${localFiles.length} files detected)`
                  : 'Select your local studio camera directory ([Root]/ containing raw, ai, thumb)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectFolder}
              disabled={syncing || isScanning}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Folder className="w-4 h-4" />
              <span>{hasHandle ? 'Change Folder' : 'Folder'}</span>
            </button>

            {hasHandle && (
              <button
                onClick={scanDirectory}
                disabled={syncing || isScanning}
                className="p-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 rounded-lg text-xs transition-colors cursor-pointer"
                title="Rescan local folder"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Subdirectories Breakdown */}
        {hasHandle && (
          <div className="mt-4 pt-4 border-t border-neutral-200/60 grid grid-cols-3 gap-3">
            <div className="bg-white border border-neutral-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-neutral-600">raw/ (Originals)</div>
              <span className="font-mono text-xs font-bold text-neutral-900">{rawCount}</span>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-neutral-600">ai/ (1024px OCR)</div>
              <span className="font-mono text-xs font-bold text-neutral-900">{aiCount}</span>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-neutral-600">thumb/ (400px Grid)</div>
              <span className="font-mono text-xs font-bold text-neutral-900">{thumbCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sync Actions Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Up-sync button */}
        <button
          onClick={handleUpSync}
          disabled={syncing || !hasHandle || isScanning}
          className="p-4 bg-white hover:bg-blue-50/50 border border-neutral-200 hover:border-blue-300 rounded-xl transition-all flex flex-col items-center text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        >
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
            <ArrowUpCircle className="w-6 h-6" />
          </div>
          <span className="font-bold text-neutral-900 text-xs mt-2.5">Up-sync</span>
          <span className="text-[11px] text-neutral-500 mt-0.5">
            {diffSummary ? `${diffSummary.toUploadCount} photos to upload` : 'Push local images to server'}
          </span>
        </button>

        {/* Down-sync button */}
        <button
          onClick={handleDownSync}
          disabled={syncing || !hasHandle || isScanning}
          className="p-4 bg-white hover:bg-purple-50/50 border border-neutral-200 hover:border-purple-300 rounded-xl transition-all flex flex-col items-center text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        >
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
            <ArrowDownCircle className="w-6 h-6" />
          </div>
          <span className="font-bold text-neutral-900 text-xs mt-2.5">Down-sync</span>
          <span className="text-[11px] text-neutral-500 mt-0.5">
            {diffSummary ? `${diffSummary.toDownloadCount} photos to pull` : 'Write server images to local'}
          </span>
        </button>

        {/* Sync (Two-way) button */}
        <button
          onClick={handleTwoWaySync}
          disabled={syncing || !hasHandle || isScanning}
          className="p-4 bg-white hover:bg-emerald-50/50 border border-neutral-200 hover:border-emerald-300 rounded-xl transition-all flex flex-col items-center text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        >
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
            <RefreshCw className={`w-6 h-6 ${syncing && activeAction === 'two-way' ? 'animate-spin' : ''}`} />
          </div>
          <span className="font-bold text-neutral-900 text-xs mt-2.5">Sync (2-Way)</span>
          <span className="text-[11px] text-neutral-500 mt-0.5">Harmonize both directions</span>
        </button>
      </div>

      {/* Live Animated Progress Bar */}
      {progress && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                progress.phase === 'complete' ? 'bg-emerald-500' : progress.phase === 'error' ? 'bg-red-500' : 'bg-blue-500 animate-ping'
              }`}></span>
              <span className="font-bold text-neutral-800 uppercase tracking-wider text-[10px]">
                {progress.phase}
              </span>
              <span className="text-neutral-500 truncate max-w-xs">{progress.message}</span>
            </div>
            <span className="font-mono font-bold text-neutral-900">{progress.percent}%</span>
          </div>

          <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 rounded-full ${
                progress.phase === 'complete' ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {progress.currentFilename && (
            <div className="text-[11px] font-mono text-neutral-500 truncate">
              File: {progress.currentFilename} ({progress.current}/{progress.total})
            </div>
          )}
        </div>
      )}

      {/* Down-sync Zip Fallback & Transfer Log */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-neutral-500">
          Browser File System Access API active • Direct disk stream
        </div>

        <button
          onClick={handleDownloadZip}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
          title="Download complete server archive as a zip file"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Zip Download Fallback</span>
        </button>
      </div>

      {/* Activity Log console */}
      {logMessages.length > 0 && (
        <div className="bg-neutral-900 text-neutral-300 rounded-xl p-3.5 font-mono text-[11px] max-h-32 overflow-y-auto space-y-1">
          <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">
            Studio Transfer Console
          </div>
          {logMessages.map((log, idx) => (
            <div key={idx} className="truncate">
              &gt; {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
