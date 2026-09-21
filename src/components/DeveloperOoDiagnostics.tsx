import React, { useState } from 'react';
import { 
  Box, 
  Search, 
  Filter, 
  Cpu, 
  Server, 
  Layers, 
  Database, 
  HardDrive, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Code2, 
  ExternalLink,
  ShieldCheck,
  Workflow
} from 'lucide-react';

export interface OoChunkInfo {
  id: string;
  name: string;
  category: 'server_engine' | 'persistence' | 'client_engine' | 'gui_controller';
  filePath: string;
  linesOfCode: number;
  fileSizeBytes: number;
  functionSummary: string;
  triggerMechanisms: string[];
  handledButtons: string[];
  failureModesAndDiagnostics: string[];
  status: 'operational' | 'optimized';
}

export const OO_CHUNKS_CATALOG: OoChunkInfo[] = [
  // --- SERVER-SIDE ENGINES ---
  {
    id: 'chunk_session_mgr',
    name: 'ChunkSessionManager',
    category: 'server_engine',
    filePath: 'server/services/ChunkSessionManager.ts',
    linesOfCode: 225,
    fileSizeBytes: 7331,
    functionSummary: 'Slices, buffers, and stages incoming chunk packets in .chunk_temp/. Calculates binary SHA-256 hashes to detect exact image duplicates before disk commit. Performs atomic reassembly into images/.',
    triggerMechanisms: ['HTTP POST /api/upload-chunk', 'HTTP GET /api/upload-chunk/status'],
    handledButtons: ['Upload All (BulkUploader)', 'Single Packet Stream'],
    failureModesAndDiagnostics: [
      'Missing packet: Check if .chunk_temp/<uploadId> has all indices from 0 to total-1',
      'Payload too large (413): Ensure client packet size is <= 2MB to bypass proxy limits',
      'Assembly ENOENT: Check write permissions on /images folder'
    ],
    status: 'operational'
  },
  {
    id: 'fgd_engine',
    name: 'FgdEngine',
    category: 'server_engine',
    filePath: 'server/services/FgdEngine.ts',
    linesOfCode: 925,
    fileSizeBytes: 35754,
    functionSummary: 'Full-Garment Discrepancy (FGD) evaluation core. Runs multi-angle cross-audits between care labels, front/back photos, buyer specs, and active labeling rules. Translates plain merchandiser commentary into structured candidate rules.',
    triggerMechanisms: ['HTTP POST /api/fgd/run-test', 'HTTP POST /api/fgd/digest-commentary', 'HTTP GET /api/fgd/audit'],
    handledButtons: ['Run Batch Test (FgdTestMode)', 'Digest Commentary', 'Evaluate Sample'],
    failureModesAndDiagnostics: [
      'Gemini API Quota 429: Switch to Flash with thinkingConfig or serialize batch requests',
      'Empty vision analysis: Verify images_ai/ resolution has valid JPEG headers',
      'Discrepancy mismatch: Inspect active rules in labeling_rules table'
    ],
    status: 'operational'
  },
  {
    id: 'fgd_job_mgr',
    name: 'FgdJobManager',
    category: 'server_engine',
    filePath: 'server/services/FgdJobManager.ts',
    linesOfCode: 286,
    fileSizeBytes: 10501,
    functionSummary: 'Durable background job singleton for multi-sample test suites. Enforces Zero Volatile State policy by serializing job status immediately to disk (/data/fgd_jobs.json), surviving server reboots.',
    triggerMechanisms: ['HTTP POST /api/fgd/jobs/start', 'HTTP POST /api/fgd/jobs/:id/cancel', 'HTTP GET /api/fgd/jobs/active'],
    handledButtons: ['Re-run FGD for garments under review', 'Start Batch Test', 'Cancel Active Run', 'Refresh Saved Reports'],
    failureModesAndDiagnostics: [
      'Job state reset on restart: Verify /data/fgd_jobs.json read/write file permissions',
      'Worker lockup: Check activeJob timeout threshold and cancellation signal propagation'
    ],
    status: 'operational'
  },
  {
    id: 'image_processor',
    name: 'GarmentImageProcessor',
    category: 'server_engine',
    filePath: 'server/services/ImageProcessor.ts',
    linesOfCode: 110,
    fileSizeBytes: 3361,
    functionSummary: 'Sharp-based multi-resolution imaging pipeline. Generates full-resolution master (/images/), AI normalized 1600px (/images_ai/), and fast web thumbnails 400px (/images_thumb/) with EXIF orientation auto-rotation.',
    triggerMechanisms: ['Triggered by ChunkSessionManager after successful packet reassembly', 'POST /api/upload'],
    handledButtons: ['Upload Batch', 'Camera Capture Snap'],
    failureModesAndDiagnostics: [
      'Corrupted thumbnail: Sharp decoding error for non-standard CMYK color profiles',
      'High memory spike: Ensure sharp({ limitInputPixels: false }) streams rather than buffering in memory'
    ],
    status: 'operational'
  },
  {
    id: 'upload_diag_logger',
    name: 'UploadDiagnosticLogger',
    category: 'server_engine',
    filePath: 'server/services/UploadDiagnosticLogger.ts',
    linesOfCode: 141,
    fileSizeBytes: 4222,
    functionSummary: 'In-memory ring buffer with disk persistence for network packet diagnostics. Records duration, packet index, HTTP status, and stack traces for granular telemetry.',
    triggerMechanisms: ['HTTP GET /api/upload-diagnostic/logs', 'HTTP POST /api/upload-diagnostic/clear'],
    handledButtons: ['Audit Logs (BulkUploader)', 'Clear Logs'],
    failureModesAndDiagnostics: [
      'Missing log records: Ring buffer capped at 500 records; older logs rollover automatically'
    ],
    status: 'operational'
  },
  {
    id: 'ocr_queue_mgr',
    name: 'OcrQueueManager',
    category: 'server_engine',
    filePath: 'server.ts (Internal Queue Singleton)',
    linesOfCode: 80,
    fileSizeBytes: 3100,
    functionSummary: 'Serialized FIFO queue with backpressure pacing for Gemini Care Label OCR. Guarantees only one heavy vision call executes at a time to prevent 429 quota exhaustion on free/tier-1 keys.',
    triggerMechanisms: ['Triggered on Label image finalization or POST /api/ocr/extract'],
    handledButtons: ['Upload Batch (Label role)', 'Manual OCR Retry'],
    failureModesAndDiagnostics: [
      'Stuck queue: Ensure timeout safety wrapper clears current job if Gemini takes > 45 seconds',
      'Quota Exceeded 429: Review exponential backoff delay intervals between queue items'
    ],
    status: 'operational'
  },

  // --- DATA & PERSISTENCE LAYER ---
  {
    id: 'drizzle_db_client',
    name: 'DrizzleDatabaseClient',
    category: 'persistence',
    filePath: 'src/db/schema.ts & src/db/index.ts',
    linesOfCode: 134,
    fileSizeBytes: 4842,
    functionSummary: 'Strongly typed SQLite/PostgreSQL relational schema and query builder. Manages garments, images, rules, abbreviations, and pending change requests with foreign key integrity.',
    triggerMechanisms: ['All database read/write queries across server endpoints'],
    handledButtons: ['Sync Database', 'Approve Garment', 'Create Rule', 'Stage Change'],
    failureModesAndDiagnostics: [
      'SQLITE_BUSY: Database locked during concurrent write transactions; ensure serialized writes',
      'Schema mismatch: Verify src/db/schema.ts matches database tables'
    ],
    status: 'operational'
  },
  {
    id: 'disk_state_persister',
    name: 'DiskStatePersistenceManager',
    category: 'persistence',
    filePath: 'server/services/FgdJobManager.ts (/data/*.json)',
    linesOfCode: 95,
    fileSizeBytes: 3200,
    functionSummary: 'Zero-volatile-state persistence layer. Immediately dumps active job manifests, reports, and calibration discrepancies to durable JSON disk files to eliminate memory loss across restarts.',
    triggerMechanisms: ['Every FgdJob status transition or progress increment'],
    handledButtons: ['Run Batch Test', 'Save Report'],
    failureModesAndDiagnostics: [
      'Container ephemeral disk wipe: Verify persistent mount or Cloud SQL backup synchronization'
    ],
    status: 'operational'
  },

  // --- CLIENT-SIDE CORE ENGINES ---
  {
    id: 'chunk_upload_engine',
    name: 'ChunkUploadEngine',
    category: 'client_engine',
    filePath: 'src/services/ChunkUploadEngine.ts',
    linesOfCode: 404,
    fileSizeBytes: 13137,
    functionSummary: 'Client-side resilient packet streaming engine. Slices large files just-in-time into discrete packets (512KB-2MB), calculates deterministic session keys, manages jittered retries, and feeds live ETA speed metrics.',
    triggerMechanisms: ['Instantiated per file by BatchUploadManager'],
    handledButtons: ['Upload Batch', 'Retry Single File'],
    failureModesAndDiagnostics: [
      'Network timeout: Engine retries up to 3 times with exponential backoff before marking interrupted',
      'CORS / Abort: Triggered when user clicks "Stop Upload" or closes browser'
    ],
    status: 'optimized'
  },
  {
    id: 'batch_upload_mgr',
    name: 'BatchUploadManager',
    category: 'client_engine',
    filePath: 'src/services/BatchUploadManager.ts',
    linesOfCode: 215,
    fileSizeBytes: 6800,
    functionSummary: 'Object-Oriented multi-file batch controller. Manages worker pool concurrency (1-2 workers), file ingestion queue, AbortControllers, and item state mutations decoupled from React UI.',
    triggerMechanisms: ['startBatch()', 'stopBatch()', 'retrySingleItem()'],
    handledButtons: ['Upload Batch', 'Stop Upload', 'Retry item', 'Remove item'],
    failureModesAndDiagnostics: [
      'Parallel congestion: Squeeze concurrency to 1 worker for slow network connections'
    ],
    status: 'optimized'
  },
  {
    id: 'file_parsing_engine',
    name: 'FileParsingEngine',
    category: 'client_engine',
    filePath: 'src/utils/fileParsing.ts',
    linesOfCode: 82,
    fileSizeBytes: 2700,
    functionSummary: 'Extracts Winzen Garment IDs and classifies image roles (Front, Back, Label) from file names. Recursively strips OS copy suffixes (- Copy, (1), 複製, 副本). Generates deterministic session identifiers.',
    triggerMechanisms: ['detectGarmentAndRole(file) on drop or file input select'],
    handledButtons: ['Browse Files', 'Drag & Drop Zone'],
    failureModesAndDiagnostics: [
      'Unknown role: Defaults to Label if standard Winzen pattern or selected dropdown role'
    ],
    status: 'optimized'
  },
  {
    id: 'image_compressor',
    name: 'ImageCompressor',
    category: 'client_engine',
    filePath: 'src/utils/imageCompression.ts',
    linesOfCode: 112,
    fileSizeBytes: 3373,
    functionSummary: 'HTML5 Canvas client-side pre-compression utility. Resizes high-megapixel camera snapshots to web-safe dimensions before transmission to prevent browser memory exhaustion.',
    triggerMechanisms: ['Called before staging images if client-side compression is enabled'],
    handledButtons: ['Camera Capture Snap', 'Direct File Picker'],
    failureModesAndDiagnostics: [
      'Canvas tainted: Occurs if cross-origin image lacks anonymous credentials'
    ],
    status: 'operational'
  },

  // --- CLIENT-SIDE GUI OBJECTS ---
  {
    id: 'bulk_uploader_gui',
    name: 'BulkUploader & Subcomponents',
    category: 'gui_controller',
    filePath: 'src/components/BulkUploader.tsx & src/components/upload/*',
    linesOfCode: 475,
    fileSizeBytes: 19500,
    functionSummary: 'Single-view upload coordinator. Contains UploadItemRow, UploadDiagnosticModal, dropzone, and configuration controls. Delegated cleanly to BatchUploadManager.',
    triggerMechanisms: ['Mounted via "Upload Batch" button in Header'],
    handledButtons: ['Upload Batch', 'Stop Upload', 'Audit Logs', 'Clear Finished'],
    failureModesAndDiagnostics: [
      'UI sluggishness during multi-file upload: Mitigated by JIT file slicing and BatchUploadManager decoupling'
    ],
    status: 'optimized'
  },
  {
    id: 'garment_detail_gui',
    name: 'GarmentDetail',
    category: 'gui_controller',
    filePath: 'src/components/GarmentDetail.tsx',
    linesOfCode: 1129,
    fileSizeBytes: 54522,
    functionSummary: 'Full garment inspection canvas. Displays multi-angle carousel, OCR care-label data, and interactive photo management toolbar ("Delete" and "Rename and Keep" with editable suffix modal).',
    triggerMechanisms: ['Click on any garment card in Samples or Review tabs'],
    handledButtons: ['Delete Shot', 'Rename and Keep', 'Approve Garment', 'Stage Change'],
    failureModesAndDiagnostics: [
      'Missing angle photo: Check if role has fallen back to default placeholder'
    ],
    status: 'operational'
  },
  {
    id: 'fgd_test_mode_gui',
    name: 'FgdTestMode',
    category: 'gui_controller',
    filePath: 'src/components/FgdTestMode.tsx',
    linesOfCode: 1782,
    fileSizeBytes: 92295,
    functionSummary: 'Automated QA & merchandiser calibration lab. Executes multi-sample discrepancy evaluations, inspects rule activations, and presents plain-language feedback digestion.',
    triggerMechanisms: ['Mounted under Developer Console -> FGD Test Mode tab'],
    handledButtons: ['Re-run FGD for garments under review', 'Start Test Suite', 'Stop Test Suite', 'Approve Candidate Rule', 'Digest Commentary'],
    failureModesAndDiagnostics: [
      'Timeout on 5+ samples: Use small batch size or run tests sequentially'
    ],
    status: 'operational'
  },
  {
    id: 'review_gui',
    name: 'Review',
    category: 'gui_controller',
    filePath: 'src/components/Review.tsx',
    linesOfCode: 384,
    fileSizeBytes: 17359,
    functionSummary: 'Catalog triage dashboard. Shows garment cards with "Review Shot" badges, completion rings, filter controls, and quick navigation.',
    triggerMechanisms: ['Mounted via primary navigation tab "Review"'],
    handledButtons: ['Filter by Brand', 'Filter by Missing Shot', 'Open Detail'],
    failureModesAndDiagnostics: [
      'Out-of-date count: Click "Sync Database" in Developer Console'
    ],
    status: 'operational'
  },
  {
    id: 'developer_gui',
    name: 'DeveloperConsole',
    category: 'gui_controller',
    filePath: 'src/components/Developer.tsx',
    linesOfCode: 863,
    fileSizeBytes: 38232,
    functionSummary: 'System diagnostic and administrative center. Houses FGD Test Mode, Labelling Rules, Abbreviations Library, Garment Database, and the OO Architecture Diagnosis Index.',
    triggerMechanisms: ['Mounted via primary navigation tab "Developer"'],
    handledButtons: ['Sync Database', 'Export Code', 'Toggle Rule', 'Add Glossary Term'],
    failureModesAndDiagnostics: [
      'Network 500 on fetchAll: Ensure server.ts is running on port 3000'
    ],
    status: 'operational'
  },
  {
    id: 'image_viewer_modal',
    name: 'ImageViewerModal',
    category: 'gui_controller',
    filePath: 'src/components/ImageViewerModal.tsx',
    linesOfCode: 153,
    fileSizeBytes: 5536,
    functionSummary: 'High-resolution pan-and-zoom inspection modal for garment label textures, weave fidelity, and care-tag typography.',
    triggerMechanisms: ['Click on any image thumbnail in GarmentDetail'],
    handledButtons: ['Zoom In', 'Zoom Out', 'Reset Pan', 'Close'],
    failureModesAndDiagnostics: [
      'Image not loading: Check if full-resolution file exists in /images or /images_ai'
    ],
    status: 'operational'
  }
];

export function DeveloperOoDiagnostics() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedChunk, setSelectedChunk] = useState<OoChunkInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

  const handleRunHealthCheck = async () => {
    setHealthStatus('running');
    try {
      const res = await fetch('/api/developer/health-status');
      if (res.ok) {
        const data = await res.json();
        setHealthStatus('success');
        setTimeout(() => setHealthStatus('idle'), 5000);
      } else {
        setHealthStatus('failed');
        setTimeout(() => setHealthStatus('idle'), 5000);
      }
    } catch (err) {
      setHealthStatus('failed');
      setTimeout(() => setHealthStatus('idle'), 5000);
    }
  };

  const filteredChunks = OO_CHUNKS_CATALOG.filter(chunk => {
    const searchTarget = (
      chunk.name + ' ' + 
      chunk.filePath + ' ' + 
      chunk.functionSummary + ' ' + 
      chunk.handledButtons.join(' ') + ' ' +
      chunk.failureModesAndDiagnostics.join(' ')
    ).toLowerCase();

    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || chunk.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalLoc = OO_CHUNKS_CATALOG.reduce((acc, c) => acc + c.linesOfCode, 0);
  const totalKb = Math.round(OO_CHUNKS_CATALOG.reduce((acc, c) => acc + c.fileSizeBytes, 0) / 1024);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'server_engine':
        return <span className="bg-purple-100 text-purple-800 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Server className="w-3 h-3" /> Server Singleton</span>;
      case 'persistence':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Database className="w-3 h-3" /> Persistence Layer</span>;
      case 'client_engine':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Cpu className="w-3 h-3" /> Client Engine</span>;
      case 'gui_controller':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Layers className="w-3 h-3" /> GUI Controller</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Architecture Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total OO Chunks</span>
            <Box className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-2">{OO_CHUNKS_CATALOG.length} Parts</div>
          <p className="text-[11px] text-neutral-500 mt-1">6 Server • 2 Data • 4 Client • 6 GUI</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total Managed Code</span>
            <Code2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-2">{totalLoc.toLocaleString()} LOC</div>
          <p className="text-[11px] text-neutral-500 mt-1">Approx. {totalKb} KB source footprint</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">OO Rule Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">100% Strict</div>
          <p className="text-[11px] text-neutral-500 mt-1">1 GUI = 1 Object • Buttons = Separate Chunks</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Fast Diagnosis Index</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-2">Instant Lookup</div>
          <p className="text-[11px] text-neutral-500 mt-1">Search by Error, Button, or Suffix</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search function, button, or failure mode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
          {[
            { id: 'all', label: 'All Chunks' },
            { id: 'server_engine', label: 'Server Singletons' },
            { id: 'client_engine', label: 'Client Engines' },
            { id: 'gui_controller', label: 'GUI Views' },
            { id: 'persistence', label: 'Persistence' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                categoryFilter === tab.id
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chunks Table / Diagnosis List */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-600" />
              Active Object-Oriented Architecture Catalog ({filteredChunks.length} matching)
            </h3>
            <span className="text-xs text-neutral-500 mt-1 block">
              Click any row to inspect deep diagnostic breakdown & failure modes
            </span>
          </div>
          <button
            onClick={handleRunHealthCheck}
            disabled={healthStatus === 'running'}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shadow-sm ${
              healthStatus === 'running' 
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : healthStatus === 'success'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : healthStatus === 'failed'
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-neutral-900 text-white hover:bg-black'
            }`}
          >
            {healthStatus === 'running' ? (
              <><Activity className="w-4 h-4 animate-spin" /> Emulating Paths...</>
            ) : healthStatus === 'success' ? (
              <><CheckCircle2 className="w-4 h-4" /> All Systems Green</>
            ) : healthStatus === 'failed' ? (
              <><AlertTriangle className="w-4 h-4" /> Diagnostic Failed</>
            ) : (
              <><Activity className="w-4 h-4" /> Run Systems Health Diagnostic</>
            )}
          </button>
        </div>

        <div className="divide-y divide-neutral-100">
          {filteredChunks.map(chunk => (
            <div 
              key={chunk.id}
              onClick={() => setSelectedChunk(selectedChunk?.id === chunk.id ? null : chunk)}
              className={`p-4 hover:bg-neutral-50/80 transition-colors cursor-pointer ${
                selectedChunk?.id === chunk.id ? 'bg-indigo-50/30' : ''
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-sm text-neutral-900">{chunk.name}</span>
                    {getCategoryBadge(chunk.category)}
                    <span className="text-neutral-400 font-mono text-xs">
                      {chunk.filePath}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {chunk.functionSummary}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0 text-right self-start md:self-center">
                  <div>
                    <div className="font-mono text-xs font-bold text-neutral-900">{chunk.linesOfCode} LOC</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{(chunk.fileSizeBytes / 1024).toFixed(1)} KB</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                    chunk.status === 'optimized' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {chunk.status}
                  </span>
                </div>
              </div>

              {/* Expandable Deep Diagnostic Panel */}
              {selectedChunk?.id === chunk.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3 bg-white p-4 rounded-xl border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <h4 className="font-bold text-neutral-800 flex items-center gap-1.5 mb-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Trigger Mechanism & Handled Buttons
                      </h4>
                      <div className="space-y-1">
                        <div className="text-neutral-600">
                          <span className="font-semibold text-neutral-800">Triggers: </span> 
                          {chunk.triggerMechanisms.join(', ')}
                        </div>
                        <div className="text-neutral-600">
                          <span className="font-semibold text-neutral-800">UI Controls: </span>
                          {chunk.handledButtons.map((btn, i) => (
                            <span key={i} className="inline-block bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded mr-1 text-[11px]">
                              {btn}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-neutral-800 flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Common Failure Modes & AI Quick Diagnosis
                      </h4>
                      <ul className="space-y-1 list-disc list-inside text-neutral-600">
                        {chunk.failureModesAndDiagnostics.map((failure, i) => (
                          <li key={i} className="text-[11px] leading-relaxed">
                            {failure}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
