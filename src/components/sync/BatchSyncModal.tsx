import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FolderSync, UploadCloud, ShieldAlert, X, Layers, RefreshCw, Sparkles, CheckCircle2 
} from 'lucide-react';
import { FolderSyncTab } from './FolderSyncTab';
import { QuarantineReviewTab } from './QuarantineReviewTab';
import { UploadDropzone } from '../upload/UploadDropzone';
import { UploadTuningBar } from '../upload/UploadTuningBar';
import { UploadItemRow } from '../upload/UploadItemRow';
import { UploadDiagnosticModal } from '../upload/UploadDiagnosticModal';
import { detectGarmentAndRole } from '../../utils/fileParsing';
import { BatchUploadManager, BatchItem } from '../../services/BatchUploadManager';

export interface BatchSyncModalProps {
  onClose: () => void;
  targetGarmentId?: string;
  onGarmentImageUpdated?: (garmentId: string, imageInfo: any) => void;
  initialTab?: 'sync' | 'direct' | 'quarantine';
}

export function BatchSyncModal({ 
  onClose, 
  targetGarmentId, 
  onGarmentImageUpdated,
  initialTab = 'sync' 
}: BatchSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'sync' | 'direct' | 'quarantine'>(initialTab);
  const [quarantineCount, setQuarantineCount] = useState<number>(0);

  // Direct Ingestion State
  const [items, setItems] = useState<BatchItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>(targetGarmentId || '');
  const [selectedRole, setSelectedRole] = useState<'Front' | 'Back' | 'Label'>('Front');
  const [garmentsList, setGarmentsList] = useState<{ id: string; buyer?: string }[]>([]);

  // Tuning parameters
  const [packetSizeKb, setPacketSizeKb] = useState<number>(1536);
  const [concurrency, setConcurrency] = useState<number>(2);

  // Diagnostic Modal
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial fetch for quarantine badge count
  useEffect(() => {
    fetch('/api/capture/quarantine')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.quarantined)) {
          setQuarantineCount(d.quarantined.length);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize BatchUploadManager for direct upload tab
  const batchManager = useMemo(() => {
    return new BatchUploadManager({
      packetSizeKb,
      concurrency,
      onItemUpdate: (updatedItem) => {
        setItems(prev => prev.map(it => it.id === updatedItem.id ? updatedItem : it));
      },
      onGarmentImageUpdated: (gId, imgInfo) => {
        if (onGarmentImageUpdated) {
          onGarmentImageUpdated(gId, imgInfo);
        }
      },
      onBatchComplete: () => {
        setUploading(false);
      }
    });
  }, []);

  useEffect(() => {
    batchManager.setOptions({ packetSizeKb, concurrency });
  }, [packetSizeKb, concurrency, batchManager]);

  useEffect(() => {
    batchManager.setItems(items);
  }, [items, batchManager]);

  useEffect(() => {
    fetch('/api/garments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setGarmentsList(data.map(g => ({ id: g.id, buyer: g.buyer || g.brand })));
          if (!selectedGarmentId && data.length > 0) {
            setSelectedGarmentId(targetGarmentId || data[0].id);
          }
        }
      })
      .catch(err => console.error('Failed to load garments:', err));
  }, [targetGarmentId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = (Array.from(e.target.files) as File[]).filter(f => f.type.startsWith('image/'));
    
    const newItems: BatchItem[] = selectedFiles.map((file, idx) => {
      const parsed = detectGarmentAndRole(file, selectedGarmentId, selectedRole);
      return {
        id: `${file.name}-${Date.now()}-${idx}`,
        file,
        garmentId: parsed.detectedGarmentId,
        role: parsed.role,
        status: 'pending',
        uploadSessionId: parsed.deterministicSessionId
      };
    });

    setItems(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
      const newItems: BatchItem[] = droppedFiles.map((file, idx) => {
        const parsed = detectGarmentAndRole(file, selectedGarmentId, selectedRole);
        return {
          id: `${file.name}-${Date.now()}-${idx}`,
          file,
          garmentId: parsed.detectedGarmentId,
          role: parsed.role,
          status: 'pending',
          uploadSessionId: parsed.deterministicSessionId
        };
      });

      setItems(prev => [...prev, ...newItems]);
    }
  };

  const pendingCount = items.filter(it => it.status === 'pending' || it.status === 'failed').length;
  const successCount = items.filter(it => it.status === 'success').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Batch Ingestion & Studio Synchronization
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              File System Access API • 2-Way Sync Engine • Quality Triage Quarantine
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-200/70 rounded-lg text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-200 bg-white">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sync'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>Folder & 2-Way Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('direct')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'direct'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Direct Drop Ingestion</span>
            {items.length > 0 && (
              <span className="bg-neutral-200 text-neutral-800 font-mono px-1.5 py-0.2 rounded text-[10px]">
                {items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('quarantine')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'quarantine'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Triage & Quarantined</span>
            {quarantineCount > 0 && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-mono px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {quarantineCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'sync' && (
            <FolderSyncTab onSyncComplete={() => {
              // Refresh quarantine count on sync
              fetch('/api/capture/quarantine')
                .then(r => r.json())
                .then(d => {
                  if (Array.isArray(d.quarantined)) setQuarantineCount(d.quarantined.length);
                })
                .catch(() => {});
            }} />
          )}

          {activeTab === 'quarantine' && (
            <QuarantineReviewTab onCountChange={setQuarantineCount} />
          )}

          {activeTab === 'direct' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <UploadDropzone
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onBrowseClick={() => fileInputRef.current?.click()}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
              />

              {/* Tuning Bar */}
              <UploadTuningBar
                packetSizeKb={packetSizeKb}
                setPacketSizeKb={setPacketSizeKb}
                concurrency={concurrency}
                setConcurrency={setConcurrency}
                uploading={uploading}
                onOpenDiagnostics={async () => {
                  setLoadingLogs(true);
                  setShowDiagnostic(true);
                  try {
                    const res = await fetch('/api/upload-diagnostic/logs?limit=50');
                    if (res.ok) setDiagnosticLogs(await res.json());
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoadingLogs(false);
                  }
                }}
              />

              {/* Queue Listing */}
              {items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-700">
                      Queue: {items.length} files ({successCount} completed, {pendingCount} pending)
                    </span>
                    {successCount > 0 && (
                      <button
                        onClick={() => setItems(prev => prev.filter(it => it.status !== 'success'))}
                        className="text-xs text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
                      >
                        Clear Finished
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {items.map(item => (
                      <UploadItemRow
                        key={item.id}
                        item={item}
                        garmentsList={garmentsList}
                        isUploading={uploading}
                        onRetry={() => batchManager.retrySingleItem(item)}
                        onRemove={() => {
                          batchManager.removeItem(item.id);
                          setItems(prev => prev.filter(it => it.id !== item.id));
                        }}
                        onUpdateGarmentId={(val) => {
                          item.garmentId = val;
                          setItems(prev => [...prev]);
                        }}
                        onUpdateRole={(val) => {
                          item.role = val;
                          setItems(prev => [...prev]);
                        }}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {uploading ? (
                      <button
                        onClick={() => {
                          batchManager.stopBatch();
                          setUploading(false);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Stop Ingestion
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setUploading(true);
                          await batchManager.startBatch();
                          setUploading(false);
                        }}
                        disabled={pendingCount === 0}
                        className="px-5 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Upload Batch ({pendingCount})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDiagnostic && (
        <UploadDiagnosticModal
          isOpen={showDiagnostic}
          logs={diagnosticLogs}
          isLoading={loadingLogs}
          onClose={() => setShowDiagnostic(false)}
          onRefresh={async () => {
            setLoadingLogs(true);
            try {
              const res = await fetch('/api/upload-diagnostic/logs?limit=50');
              if (res.ok) setDiagnosticLogs(await res.json());
            } finally {
              setLoadingLogs(false);
            }
          }}
          onClear={async () => {
            await fetch('/api/upload-diagnostic/clear', { method: 'POST' });
            setDiagnosticLogs([]);
          }}
        />
      )}
    </div>
  );
}
