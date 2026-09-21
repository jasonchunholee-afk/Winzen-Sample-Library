const fs = require('fs');
let code = fs.readFileSync('src/components/Capture.tsx', 'utf8');

// Replace the mock live feed with actual video elements and device selection
const updatedCode = `import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, Focus, Maximize, Trash2, Camera } from "lucide-react";

export function Capture() {
  const [garmentCount, setGarmentCount] = useState(1);
  const [shots, setShots] = useState<{ id: string, type: 'top' | 'macro', time: Date }[]>([]);
  const [lastPedal, setLastPedal] = useState<'top' | 'macro' | null>(null);
  
  // WebRTC State
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [topCameraId, setTopCameraId] = useState<string>('');
  const [macroCameraId, setMacroCameraId] = useState<string>('');
  const topVideoRef = useRef<HTMLVideoElement>(null);
  const macroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true }); // trigger permission prompt
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setTopCameraId(videoDevices[0].deviceId);
          if (videoDevices.length > 1) {
            setMacroCameraId(videoDevices[1].deviceId);
          } else {
            setMacroCameraId(videoDevices[0].deviceId);
          }
        }
      } catch (err) {
        console.error("Camera access denied or unavailable", err);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    let topStream: MediaStream | null = null;
    let macroStream: MediaStream | null = null;

    async function startStreams() {
      if (topCameraId && topVideoRef.current) {
        try {
          topStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: topCameraId } } });
          topVideoRef.current.srcObject = topStream;
        } catch (e) { console.error("Top camera error", e); }
      }
      if (macroCameraId && macroVideoRef.current) {
        try {
          macroStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: macroCameraId } } });
          macroVideoRef.current.srcObject = macroStream;
        } catch (e) { console.error("Macro camera error", e); }
      }
    }
    startStreams();

    return () => {
      if (topStream) topStream.getTracks().forEach(t => t.stop());
      if (macroStream) macroStream.getTracks().forEach(t => t.stop());
    };
  }, [topCameraId, macroCameraId]);

  const handlePedal = useCallback((type: 'top' | 'macro') => {
    setShots(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, time: new Date() }]);
    setLastPedal(type);
    setTimeout(() => setLastPedal(null), 300);
  }, []);

  const handleNextGarment = useCallback(() => {
    setShots([]);
    setGarmentCount(p => p + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') handlePedal('top');
      if (e.key === 'ArrowLeft') handlePedal('macro');
      if (e.key === 'Enter' && shots.length > 0) handleNextGarment();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePedal, handleNextGarment, shots.length]);

  const removeShot = (id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100 flex flex-col font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Capture Station</h2>
          <p className="text-neutral-400 mt-1">Processing Garment #{garmentCount}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-800 flex items-center gap-3">
            <Camera className="w-4 h-4 text-neutral-400" />
            <select 
              className="bg-transparent text-sm font-medium text-neutral-300 outline-none"
              value={topCameraId}
              onChange={e => setTopCameraId(e.target.value)}
            >
              {devices.map(d => <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900">{d.label || 'Camera'}</option>)}
            </select>
          </div>
          <div className="bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-800 flex items-center gap-3">
            <Camera className="w-4 h-4 text-neutral-400" />
            <select 
              className="bg-transparent text-sm font-medium text-neutral-300 outline-none"
              value={macroCameraId}
              onChange={e => setMacroCameraId(e.target.value)}
            >
              {devices.map(d => <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900">{d.label || 'Camera'}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Top Camera Feed */}
        <div className={\`bg-neutral-900 border-2 rounded-2xl flex flex-col overflow-hidden relative transition-colors duration-150 \${lastPedal === 'top' ? 'border-blue-500 bg-blue-900/20' : 'border-neutral-800'}\`}>
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md text-xs font-bold tracking-wider text-white z-10 flex items-center gap-2">
            <Maximize className="w-4 h-4" /> TOP CAMERA (TABLE)
          </div>
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md text-xs font-bold tracking-wider text-neutral-400 z-10">
            RIGHT PEDAL (OR RIGHT ARROW)
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative bg-black">
            <video ref={topVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
            {!topCameraId && <p className="text-neutral-500 font-medium z-10">Allow camera access to view feed...</p>}
          </div>
        </div>

        {/* Macro Camera Feed */}
        <div className={\`bg-neutral-900 border-2 rounded-2xl flex flex-col overflow-hidden relative transition-colors duration-150 \${lastPedal === 'macro' ? 'border-blue-500 bg-blue-900/20' : 'border-neutral-800'}\`}>
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md text-xs font-bold tracking-wider text-white z-10 flex items-center gap-2">
            <Focus className="w-4 h-4" /> MACRO CAMERA (LABEL)
          </div>
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md text-xs font-bold tracking-wider text-neutral-400 z-10">
            LEFT PEDAL (OR LEFT ARROW)
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative bg-black">
             <video ref={macroVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
             {!macroCameraId && <p className="text-neutral-500 font-medium z-10">Allow camera access to view feed...</p>}
          </div>
        </div>
      </div>

      {/* Captured Shots Filmstrip */}
      <div className="mt-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">Current Session Shots ({shots.length})</h3>
          <button 
            onClick={handleNextGarment}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm text-sm font-bold tracking-wide transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={shots.length === 0}
          >
            NEXT GARMENT (ENTER) <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        {shots.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-neutral-500 border border-dashed border-neutral-700 rounded-xl bg-neutral-900/50">
            Step on pedals to capture shots...
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 min-h-28">
            {shots.map((shot, idx) => (
              <div key={shot.id} className="relative w-28 h-28 bg-neutral-800 rounded-xl border border-neutral-700 flex-shrink-0 flex items-center justify-center group animate-in fade-in zoom-in duration-200 overflow-hidden">
                <span className="text-neutral-500 font-bold text-sm tracking-wider uppercase z-10 bg-black/50 px-2 py-1 rounded">{shot.type}</span>
                <div className="absolute top-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-neutral-300 z-10">
                  #{idx + 1}
                </div>
                <button 
                  onClick={() => removeShot(shot.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/Capture.tsx', updatedCode);
