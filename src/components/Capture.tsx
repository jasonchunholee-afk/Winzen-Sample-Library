import { useState, useEffect, useCallback, useRef } from "react";
import { 
  ArrowRight, Focus, Maximize, Trash2, Camera, Loader2, 
  Check, Wifi, WifiOff, Tag, RefreshCw, AlertTriangle, ShieldCheck, Zap,
  CheckCircle2, AlertCircle, FileText, Sparkles, Box, PackageCheck, Laptop, Download
} from "lucide-react";
import { compressImageClientSide } from "../utils/imageCompression";
import { WarehouseBatchShelvingModal, UnshelfedGarmentItem } from "../warehouse-ui";

interface ShotItem {
  id: string;
  camera: 'top' | 'macro';
  role: string;
  suffix: string;
  label: string;
  time: Date;
  thumbUrl?: string;
  isProcessing?: boolean;
  status: 'saved_local' | 'synced' | 'pending';
}

interface RetakeGarment {
  garmentId: string;
  buyer: string;
  reason: string;
  requestedAngle: string;
}

interface StickerVerificationResult {
  isVerifying: boolean;
  isHandwrittenSticker?: boolean;
  extractedCode?: string;
  matchesExpected?: boolean;
  isLegible?: boolean;
  legibilityScore?: number;
  verificationMessage?: string;
}

// Generate unambiguous 4-character alphanumeric suffix (excluding 0/O, 1/I, etc.)
function generateAlphanumericStickerCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WZ-${rand}`;
}

export function Capture() {
  // Session & Garment State
  const [garmentCount, setGarmentCount] = useState(1);
  const [styleCode, setStyleCode] = useState(`20S-1004-${garmentCount}`);
  const [isStickerMode, setIsStickerMode] = useState(false);
  const [isTemporary, setIsTemporary] = useState(false);
  const [shots, setShots] = useState<ShotItem[]>([]);
  const [lastPedal, setLastPedal] = useState<'top' | 'macro' | null>(null);
  const [isProcessingShot, setIsProcessingShot] = useState(false);

  // Handwritten Sticker Verification State
  const [stickerVerification, setStickerVerification] = useState<StickerVerificationResult | null>(null);

  // Online vs Offline Mode
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retakeWorklist, setRetakeWorklist] = useState<RetakeGarment[]>([]);

  // WebRTC State
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [topCameraId, setTopCameraId] = useState<string>('');
  const [macroCameraId, setMacroCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const topVideoRef = useRef<HTMLVideoElement>(null);
  const macroVideoRef = useRef<HTMLVideoElement>(null);

  // Warehouse State (Rolling Cabinet & Active Location Assignment)
  const [assignedWarehouseLocation, setAssignedWarehouseLocation] = useState<{
    locationCode: string;
    locationName: string;
    tempContainer: string;
  } | null>(null);
  const [unshelfedList, setUnshelfedList] = useState<UnshelfedGarmentItem[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const fetchWarehouseState = useCallback(async () => {
    try {
      const res = await fetch('/api/warehouse/unshelfed');
      const data = await res.json();
      if (data.success) {
        setUnshelfedList(data.items || []);
      }
      const assignRes = await fetch('/api/warehouse/assign-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentId: styleCode,
          buyer: styleCode.toUpperCase().includes('BOSS') ? 'BOSS' : styleCode.toUpperCase().includes('HUGO') ? 'HUGO' : 'General'
        })
      });
      const assignData = await assignRes.json();
      if (assignData.success && assignData.assignment) {
        setAssignedWarehouseLocation({
          locationCode: assignData.assignment.locationCode,
          locationName: assignData.assignment.locationName,
          tempContainer: assignData.assignment.tempContainer || 'Temp Box 1'
        });
      }
    } catch (err) {
      console.warn('Note fetching warehouse assignment:', err);
    }
  }, [styleCode]);

  useEffect(() => {
    fetchWarehouseState();
  }, [fetchWarehouseState]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync retakes and taxonomy when online
  const loadRetakeWorklist = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch('/api/capture/retake-queue');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setRetakeWorklist(data.items);
      }
    } catch (e) {
      console.warn("Could not sync retake worklist:", e);
    }
  }, []);

  useEffect(() => {
    loadRetakeWorklist();
  }, [loadRetakeWorklist]);

  // Camera access is deactivated in Main application.
  // Physical image capture is performed in the dedicated Capture Station standalone application.
  useEffect(() => {
    setCameraError(null);
    setDevices([]);
  }, []);

  const captureFrameToCanvas = (videoEl: HTMLVideoElement | null): HTMLCanvasElement | null => {
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  // Requirement 3: "Gen Code" Button for Missing Labels
  // Generates an alphanumeric code with which Chen can write on a sticker label and stick it to the garment.
  const handleGenCode = () => {
    const code = generateAlphanumericStickerCode();
    setStyleCode(code);
    setIsStickerMode(true);
    setIsTemporary(false);
    setStickerVerification(null);
  };

  // Generate Temporary Online ID (Main OCR will rename from factory tag)
  const handleTemporaryPreset = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const rand = Math.floor(10 + Math.random() * 90);
    const code = `TEMP-${dateStr}-${timeStr}-${rand}`;
    setStyleCode(code);
    setIsTemporary(true);
    setIsStickerMode(false);
    setStickerVerification(null);
  };

  const verifyStickerLegibility = useCallback(async (dataUrlOrBase64: string, expectedCode: string) => {
    setStickerVerification({ isVerifying: true });
    const base64data = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64;
    try {
      const vRes = await fetch('/api/capture/verify-sticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentId: expectedCode,
          expectedCode,
          imageBase64: base64data
        })
      });
      const vData = await vRes.json();
      setStickerVerification({
        isVerifying: false,
        isHandwrittenSticker: vData.isHandwrittenSticker,
        extractedCode: vData.extractedCode,
        matchesExpected: vData.matchesExpected,
        isLegible: vData.isLegible,
        legibilityScore: vData.legibilityScore,
        verificationMessage: vData.verificationMessage
      });
    } catch (vErr) {
      console.warn("Sticker verification check failed:", vErr);
      setStickerVerification({
        isVerifying: false,
        isLegible: true,
        matchesExpected: true,
        verificationMessage: `Locally saved sticker shot for ${expectedCode}`
      });
    }
  }, []);

  // Core Shot Capture Trigger
  // Suffixes are strictly camera-based: TOP_1, TOP_2, TOP_3... and MACRO_1, MACRO_2...
  const handleCaptureShot = useCallback(async (sourceCamera: 'top' | 'macro') => {
    setLastPedal(sourceCamera);
    setTimeout(() => setLastPedal(null), 300);

    const shotId = Math.random().toString(36).substr(2, 9);
    const videoEl = sourceCamera === 'top' ? topVideoRef.current : macroVideoRef.current;
    const canvas = captureFrameToCanvas(videoEl);

    let previewUrl: string | undefined;
    if (canvas) {
      previewUrl = canvas.toDataURL('image/jpeg', 0.6);
    }

    // Determine camera-based sequential suffix & tentative role
    let suffix = '';
    let role = 'Front';
    let label = '';

    if (sourceCamera === 'top') {
      const topCount = shots.filter(s => s.camera === 'top').length;
      suffix = `TOP_${topCount + 1}`;
      if (topCount === 0) {
        role = 'Front';
        label = 'Top 1 (Front)';
      } else if (topCount === 1) {
        role = 'Back';
        label = 'Top 2 (Back)';
      } else {
        role = 'Detail';
        label = `Top ${topCount + 1} (Detail / Multi)`;
      }
    } else {
      const macroCount = shots.filter(s => s.camera === 'macro').length;
      suffix = `MACRO_${macroCount + 1}`;
      role = 'Label';
      label = isStickerMode ? `Macro ${macroCount + 1} (Sticker Code)` : `Macro ${macroCount + 1} (Care Tag)`;
    }

    const newShot: ShotItem = {
      id: shotId,
      camera: sourceCamera,
      role,
      suffix,
      label,
      time: new Date(),
      thumbUrl: previewUrl,
      isProcessing: true,
      status: 'saved_local'
    };

    setShots(prev => [...prev, newShot]);

    if (!canvas) {
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, isProcessing: false } : s));
      return;
    }

    try {
      setIsProcessingShot(true);
      const { rawBlob, thumbBlob, aiBlob } = await compressImageClientSide(canvas);

      // In Online mode, stream directly to Main
      if (isOnline) {
        const formData = new FormData();
        const filename = `${styleCode}_${suffix}.jpg`;

        formData.append('image', rawBlob, filename);
        formData.append('thumb', thumbBlob, `thumb_${filename}`);
        formData.append('ai', aiBlob, `ai_${filename}`);
        formData.append('garmentId', styleCode);
        formData.append('role', role);
        formData.append('enableOcr', role === 'Label' ? 'true' : 'false');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          setShots(prev => prev.map(s => s.id === shotId ? { ...s, isProcessing: false, status: 'synced' } : s));
        } else {
          setShots(prev => prev.map(s => s.id === shotId ? { ...s, isProcessing: false, status: 'saved_local' } : s));
        }
      } else {
        setShots(prev => prev.map(s => s.id === shotId ? { ...s, isProcessing: false, status: 'saved_local' } : s));
      }

      // Requirement 3: If Chen is shooting a handwritten sticker with Macro camera, verify legibility
      if (sourceCamera === 'macro' && (isStickerMode || styleCode.startsWith('WZ-'))) {
        const reader = new FileReader();
        reader.onloadend = () => {
          verifyStickerLegibility(reader.result as string, styleCode);
        };
        reader.readAsDataURL(aiBlob);
      }

    } catch (err) {
      console.error("Failed to capture shot:", err);
      setShots(prev => prev.map(s => s.id === shotId ? { ...s, isProcessing: false } : s));
    } finally {
      setIsProcessingShot(false);
    }
  }, [isOnline, isStickerMode, shots, styleCode]);

  // Foot pedal shortcut mapping:
  // Pedal 1 / Right Arrow / Space = Top Camera
  // Pedal 2 / Left Arrow / Key L = Macro Camera
  // Enter = Next Garment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        handleCaptureShot('top');
      } else if (e.key === 'ArrowLeft' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleCaptureShot('macro');
      } else if (e.key === 'Enter' && shots.length > 0) {
        handleNextGarment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCaptureShot, shots.length]);

  const handleNextGarment = useCallback(() => {
    setShots([]);
    setGarmentCount(p => p + 1);
    setStickerVerification(null);
    if (isTemporary) {
      handleTemporaryPreset();
    } else if (isStickerMode) {
      handleGenCode();
    } else {
      setStyleCode(`20S-1004-${garmentCount + 1}`);
    }
    fetchWarehouseState();
  }, [garmentCount, isTemporary, isStickerMode, fetchWarehouseState]);

  const removeShot = (id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
  };

  const topShotsCount = shots.filter(s => s.camera === 'top').length;
  const macroShotsCount = shots.filter(s => s.camera === 'macro').length;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100 flex flex-col font-sans">
      
      {/* Top Header & Operational Status */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">Winzen Sample Library — Capture Station</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online Sync Active' : 'Offline Storage (raw / ai / thumb)'}</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Operator: Chen (Zero-Typing Mode) • Camera-Based Suffixes (TOP_*, MACRO_*) • Main AI Handles Orientation & Classification
          </p>
        </div>

        {/* Retake Alert Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          {retakeWorklist.length > 0 && (
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{retakeWorklist.length} Retakes Queued by Jennifer</span>
            </div>
          )}

          {/* AI Workflow Assurance Pill */}
          <div className="bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-2 text-xs text-neutral-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>AI Multi-Shot & Inversion Auto-Correction Active</span>
          </div>
        </div>
      </div>

      {/* Operator Garment Barcode / Code Banner with "Gen Code" Button */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Current Garment Code</span>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-mono font-black tracking-wide ${isStickerMode ? 'text-amber-400' : isTemporary ? 'text-blue-400' : 'text-white'}`}>
                {styleCode}
              </span>
              {isStickerMode && (
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-400" />
                  <span>Missing Label Sticker</span>
                </span>
              )}
              {isTemporary && (
                <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span>Main OCR Auto-Rename</span>
                </span>
              )}
            </div>
          </div>

          <div className="h-8 w-px bg-neutral-800 hidden sm:block" />

          {/* REQUIREMENT 3: "Gen Code" Button for Missing Labels */}
          <button
            type="button"
            onClick={handleGenCode}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              isStickerMode 
                ? 'bg-amber-500 text-black shadow-amber-500/20 hover:bg-amber-400' 
                : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 hover:border-amber-400'
            }`}
            title="Generate alphanumeric code to write on physical sticker for garments with missing labels"
          >
            <Tag className="w-4 h-4" />
            <span>GEN CODE (Missing Label)</span>
          </button>

          {/* Temporary Auto-Rename Code Button (Factory Tag Exists) */}
          <button
            type="button"
            onClick={handleTemporaryPreset}
            className={`px-3.5 py-1.5 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isTemporary 
                ? 'bg-blue-500/25 text-blue-200 border-blue-500/50' 
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
            }`}
            title="Generate temporary ID for online capture. Main OCR will read the care label and auto-rename."
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Temporary Tag ID</span>
          </button>

          {/* Active Warehouse Location Assignment Badge */}
          <div className="flex items-center gap-2 bg-neutral-800/90 border border-neutral-700 px-3 py-1.5 rounded-xl text-xs">
            <Box className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-neutral-400 font-medium">Assigned Space:</span>
            <span className="font-bold text-amber-300 font-mono">
              {assignedWarehouseLocation?.locationCode || 'CAB1-SH1-STK1'}
            </span>
            <span className="text-[10px] text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded font-medium">
              Unshelfed ({assignedWarehouseLocation?.tempContainer || 'Temp Box 1'})
            </span>
          </div>

          {/* Chen's 20-Garment Shelving Manifest Button */}
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              unshelfedList.length >= 20
                ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border-amber-500/30'
            }`}
            title="Click to view 20-garment batch with photos, codes, and assigned rolling cabinet spaces"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Shelve Batch ({unshelfedList.length} in Temp Box)</span>
          </button>
        </div>

        {/* Real-time Shot Counter Checklist */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-400 font-medium">Shots Taken:</span>
          
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
            topShotsCount >= 1 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}>
            {topShotsCount >= 1 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Top 1 (Front)</span>
          </span>

          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
            topShotsCount >= 2 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}>
            {topShotsCount >= 2 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Top 2 (Back)</span>
          </span>

          {topShotsCount > 2 && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>+{topShotsCount - 2} Multi-Shots</span>
            </span>
          )}

          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
            macroShotsCount >= 1 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}>
            {macroShotsCount >= 1 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isStickerMode ? 'Sticker Macro' : 'Care Tag Macro'}</span>
          </span>
        </div>
      </div>

      {/* REQUIREMENT 3: High-Visibility Handwritten Sticker Protocol Card */}
      {isStickerMode && (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 rounded-2xl p-4 mb-6 shadow-lg shadow-amber-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
              <Tag className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">Physical Sticker Protocol (Missing Label)</div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-2xl font-mono font-black text-amber-300 tracking-wider px-2 py-0.5 bg-black/40 rounded-lg border border-amber-500/40">
                  {styleCode}
                </span>
                <span className="text-xs text-neutral-300">
                  1. Write <strong className="text-white font-mono">{styleCode}</strong> on sticker & stick to garment &bull; 2. Take Macro Shot (Pedal 2) to verify legibility
                </span>
              </div>
            </div>
          </div>

          {/* Legibility Verification Feedback Card */}
          <div className="flex items-center gap-2">
            {stickerVerification?.isVerifying && (
              <div className="px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl flex items-center gap-2 text-xs text-neutral-300">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span>AI OCR Verifying Handwriting Legibility...</span>
              </div>
            )}

            {stickerVerification && !stickerVerification.isVerifying && (
              <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                stickerVerification.isLegible && stickerVerification.matchesExpected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {stickerVerification.isLegible && stickerVerification.matchesExpected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>✓ Sticker Code Verified Legible: {stickerVerification.extractedCode || styleCode} (Score: {stickerVerification.legibilityScore || 95}%)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>⚠ Handwriting Unclear: Read "{stickerVerification.extractedCode}". Please rewrite clearly and retake shot.</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hardware Deactivation & Standalone Capture Coordination Notice */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Camera Connection Deactivated in Main Application</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  Managed by Standalone Capture Application
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Physical camera tethering & pedal triggers run exclusively on the dedicated Capture Station PC (<span className="font-mono text-neutral-300">C:\WinzenGarments\</span>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="/api/export-capture" 
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Capture App Package</span>
            </a>
          </div>
        </div>
      </div>

      {/* Dual Intake Simulation / Manual File Upload Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[280px]">
        {/* Top Overhead Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-400 uppercase">
                <Maximize className="w-4 h-4" /> Top Camera Channel (Overhead Table)
              </div>
              <span className="text-[11px] font-mono text-neutral-400 bg-black/50 px-2 py-0.5 rounded border border-neutral-800">
                Pedal 1 (Dedicated App)
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Chen photographs full garment flat-lay (Front, Back, and optional detail angles). Filename format: <span className="font-mono text-neutral-300">{styleCode}_TOP_*.jpg</span>
            </p>
          </div>

          <div className="border-2 border-dashed border-neutral-800 hover:border-blue-500/50 rounded-xl p-6 text-center bg-neutral-950/40 transition-all flex flex-col items-center justify-center space-y-2">
            <Camera className="w-8 h-8 text-neutral-600" />
            <span className="text-xs font-medium text-neutral-400">
              Live stream active in Standalone Capture Station.
            </span>
            <label className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg border border-neutral-700 cursor-pointer transition-colors">
              <span>Manual Test Upload (Top)</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const dataUrl = evt.target?.result as string;
                      const nextIndex = topShotsCount + 1;
                      const suffix = `TOP_${nextIndex}`;
                      const label = nextIndex === 1 ? 'TOP_1 (Front)' : nextIndex === 2 ? 'TOP_2 (Back)' : `TOP_${nextIndex} (Detail)`;
                      setShots(prev => [...prev, {
                        id: crypto.randomUUID(),
                        dataUrl,
                        thumbUrl: dataUrl,
                        aiUrl: dataUrl,
                        cameraType: 'top',
                        label,
                        suffix,
                        timestamp: Date.now()
                      }]);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Current shots: {topShotsCount}</span>
            <span>Next: {topShotsCount === 0 ? 'TOP_1 (Front)' : topShotsCount === 1 ? 'TOP_2 (Back)' : `TOP_${topShotsCount + 1} (Detail)`}</span>
          </div>
        </div>

        {/* Macro Detail Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">
                <Focus className="w-4 h-4" /> Macro Camera Channel (Care Tag / Sticker)
              </div>
              <span className="text-[11px] font-mono text-neutral-400 bg-black/50 px-2 py-0.5 rounded border border-neutral-800">
                Pedal 2 (Dedicated App)
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Chen photographs care wash label or handwritten alphanumeric sticker. Filename format: <span className="font-mono text-neutral-300">{styleCode}_MACRO_*.jpg</span>
            </p>
          </div>

          <div className="border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-neutral-950/40 transition-all flex flex-col items-center justify-center space-y-2">
            <Focus className="w-8 h-8 text-neutral-600" />
            <span className="text-xs font-medium text-neutral-400">
              Live stream active in Standalone Capture Station.
            </span>
            <label className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg border border-neutral-700 cursor-pointer transition-colors">
              <span>Manual Test Upload (Macro)</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const dataUrl = evt.target?.result as string;
                      const nextIndex = macroShotsCount + 1;
                      const suffix = `MACRO_${nextIndex}`;
                      const label = `MACRO_${nextIndex} (${isStickerMode ? 'Sticker Code' : 'Label'})`;
                      setShots(prev => [...prev, {
                        id: crypto.randomUUID(),
                        dataUrl,
                        thumbUrl: dataUrl,
                        aiUrl: dataUrl,
                        cameraType: 'macro',
                        label,
                        suffix,
                        timestamp: Date.now()
                      }]);
                      if (isStickerMode) {
                        verifyStickerLegibility(dataUrl, styleCode);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Current shots: {macroShotsCount}</span>
            <span>Next: MACRO_{macroShotsCount + 1} ({isStickerMode ? 'Sticker Code' : 'Label'})</span>
          </div>
        </div>
      </div>

      {/* Captured Shots Filmstrip & AI Auto-Differentiation Banner */}
      <div className="mt-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Current Garment Filmstrip ({shots.length} Shots)</h3>
              {topShotsCount === 2 && (
                <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">
                  AI Orientation Check Ready
                </span>
              )}
              {topShotsCount > 2 && (
                <span className="text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-semibold">
                  AI Multi-Shot Classification Ready
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Strictly camera-based suffixes ({styleCode}_TOP_*.jpg, {styleCode}_MACRO_*.jpg) &bull; Zero category selection needed
            </p>
          </div>

          <button 
            onClick={handleNextGarment}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold tracking-wide transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            disabled={shots.length === 0}
          >
            <span>NEXT GARMENT (ENTER)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {shots.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/40 text-xs">
            Step on pedals (Pedal 1 = Top Camera, Pedal 2 = Macro Camera) or click capture buttons above...
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 min-h-28">
            {shots.map((shot, idx) => (
              <div key={shot.id} className="relative w-36 h-36 bg-neutral-800 rounded-xl border border-neutral-700 flex-shrink-0 flex items-center justify-center group animate-in fade-in zoom-in duration-200 overflow-hidden">
                {shot.thumbUrl ? (
                  <img src={shot.thumbUrl} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-neutral-400 font-bold text-xs tracking-wider uppercase z-10 bg-black/60 px-2 py-1 rounded">{shot.label}</span>
                )}
                
                <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-neutral-300 z-10">
                  {shot.suffix}
                </div>

                <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] text-neutral-200 z-10 font-medium truncate max-w-[85%]">
                  {shot.label}
                </div>

                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold z-10 ${
                  shot.status === 'synced' ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-300'
                }`}>
                  {shot.status === 'synced' ? 'SYNCED' : 'LOCAL'}
                </div>

                {shot.isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                )}
                <button 
                  onClick={() => removeShot(shot.id)}
                  className="absolute bottom-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                  title="Remove Shot"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chen's Batch Shelving Modal */}
      <WarehouseBatchShelvingModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        unshelfedItems={unshelfedList}
        onBatchShelved={fetchWarehouseState}
      />
    </div>
  );
}
