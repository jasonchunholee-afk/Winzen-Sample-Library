import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, 
  Layers, Sparkles, BrainCircuit, ShieldAlert, Clock, ArrowRight, X
} from 'lucide-react';

interface SpaceAssignmentBoxProps {
  garment: any;
  onAssigned?: (locationCode: string) => void;
  onClose?: () => void;
}

// Warehouse physical topology constants
const AREA_DEFINITIONS: Record<string, { name: string; trackNo: number; cabinetsCount: number; defaultStacks: number; unpartitioned?: boolean }> = {
  'A': { name: 'Track A (Set 1/6 • Carriages A1–A11)', trackNo: 1, cabinetsCount: 11, defaultStacks: 3 },
  'B': { name: 'Track B (Set 2/6 • Single-Bay Carriages B1–B10)', trackNo: 2, cabinetsCount: 10, defaultStacks: 5, unpartitioned: true },
  'C': { name: 'Track C (Set 3/6 • Carriages C1–C9)', trackNo: 3, cabinetsCount: 9, defaultStacks: 3 },
  'D': { name: 'Track D (Set 4/6 • Carriages D1–D11)', trackNo: 4, cabinetsCount: 11, defaultStacks: 3 },
  'E': { name: 'Track E (Set 5/6 • Carriages E1–E10)', trackNo: 5, cabinetsCount: 10, defaultStacks: 3 },
  'F': { name: 'Track F (Set 6/6 • Carriages F1–F8)', trackNo: 6, cabinetsCount: 8, defaultStacks: 3 },
};

export function SpaceAssignmentBox({ garment, onAssigned, onClose }: SpaceAssignmentBoxProps) {
  const [activePhase, setActivePhase] = useState<'manual' | 'recommend' | 'auto'>('manual');
  
  // Cascading location inputs
  const [areaInput, setAreaInput] = useState<string>('B');
  const [cabinetInput, setCabinetInput] = useState<string>('B1');
  const [shelfInput, setShelfInput] = useState<string>('1');
  const [stackInput, setStackInput] = useState<string>('1');
  
  // Organisation Logic
  const [logicText, setLogicText] = useState<string>('');
  
  // Submitting & status
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available cabinets for current area
  const availableCabinets = useMemo(() => {
    const cleanArea = (areaInput || 'A').toUpperCase().trim();
    const def = AREA_DEFINITIONS[cleanArea];
    if (!def) return [];
    return Array.from({ length: def.cabinetsCount }, (_, i) => `${cleanArea}${i + 1}`);
  }, [areaInput]);

  // Available shelves (5 for Area B and C9, 10 for others)
  const availableShelves = useMemo(() => {
    const cab = (cabinetInput || '').toUpperCase().trim();
    const count = (cab.startsWith('B') || cab === 'C9') ? 5 : 10;
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }, [cabinetInput]);

  // Available stacks based on cabinet rules
  const availableStacks = useMemo(() => {
    const cab = (cabinetInput || '').toUpperCase().trim();
    if (cab === 'A1' || cab === 'A2') {
      return ['1', '2'];
    }
    if (cab.startsWith('B')) {
      return ['1', '2', '3', '4', '5'];
    }
    if (cab === 'C9') {
      return ['1', '2', '3'];
    }
    return ['1', '2', '3'];
  }, [cabinetInput]);

  // When Area changes, validate/update Cabinet
  const handleAreaChange = (newArea: string) => {
    const clean = newArea.toUpperCase();
    setAreaInput(clean);
    const def = AREA_DEFINITIONS[clean];
    if (def) {
      setCabinetInput(`${clean}1`);
      setShelfInput('1');
      setStackInput('1');
    }
  };

  // When Cabinet changes, validate/update Stack
  const handleCabinetChange = (newCab: string) => {
    const clean = newCab.toUpperCase().trim();
    setCabinetInput(clean);
    const maxShelves = (clean.startsWith('B') || clean === 'C9') ? 5 : 10;
    if (parseInt(shelfInput) > maxShelves) setShelfInput('1');

    if (clean === 'A1' || clean === 'A2') {
      if (parseInt(stackInput) > 2) setStackInput('1');
    } else if (clean === 'C9') {
      if (parseInt(stackInput) > 3) setStackInput('1');
    } else if (!clean.startsWith('B')) {
      if (parseInt(stackInput) > 3) setStackInput('1');
    }
  };

  // Computed final location code
  const targetLocationCode = useMemo(() => {
    const cab = cabinetInput.trim().toUpperCase();
    const sh = shelfInput.trim();
    const st = stackInput.trim();
    if (!cab || !sh || !st) return '';
    return `${cab}-${sh}-${st}`;
  }, [cabinetInput, shelfInput, stackInput]);

  // Handle assignment submission
  const handleAssign = async () => {
    if (!targetLocationCode) {
      setStatusMessage({ type: 'error', text: 'Please specify a complete Area, Cabinet, Shelf, and Stack.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/warehouse/assign-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentId: garment.id,
          locationCode: targetLocationCode,
          logicText: logicText.trim(),
          assignedBy: 'Jennifer'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign space');
      }

      setStatusMessage({ 
        type: 'success', 
        text: `Successfully assigned ${garment.id} to physical space ${targetLocationCode}!` 
      });

      if (onAssigned) {
        onAssigned(targetLocationCode);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error executing manual assignment.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-neutral-900 text-white border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-neutral-100">Warehouse Space Assignment</h3>
              <span className="bg-neutral-800 text-orange-300 font-mono text-xs px-2 py-0.5 rounded border border-neutral-700">
                {garment.id}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Current Location: <strong className="text-neutral-200 font-mono">{garment.assigned_location || garment.location || 'Unassigned / Vault'}</strong>
            </p>
          </div>
        </div>

        {onClose && (
          <button 
            type="button" 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 3-Phase Roadmap Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
          Assignment Mode
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Phase 1: Manual Assign */}
          <button
            type="button"
            onClick={() => setActivePhase('manual')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activePhase === 'manual'
                ? 'bg-neutral-800 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-neutral-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-400" />
                Manual Assign
              </span>
              <span className="bg-green-950 text-green-400 border border-green-700/50 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Jennifer directly designates location & logs rationale to teach AI patterns.
            </p>
          </button>

          {/* Phase 2: Recommend & Choose */}
          <button
            type="button"
            disabled
            className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 text-left opacity-70 cursor-not-allowed relative group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-neutral-300 flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-blue-400" />
                Recommend & Choose
              </span>
              <span className="bg-blue-950/60 text-blue-400 border border-blue-800/40 text-[10px] font-medium px-2 py-0.5 rounded-full">
                Phase 2 (Next)
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              AI suggests candidate stacks matching hashtags & buyer rules; user confirms.
            </p>
          </button>

          {/* Phase 3: Auto-assign */}
          <button
            type="button"
            disabled
            className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-950/40 text-left opacity-70 cursor-not-allowed"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Auto-assign
              </span>
              <span className="bg-purple-950/60 text-purple-400 border border-purple-800/40 text-[10px] font-medium px-2 py-0.5 rounded-full">
                Phase 3
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Full autonomous shelving executed upon intake based on threshold certainty.
            </p>
          </button>
        </div>
      </div>

      {/* Manual Input Form */}
      {activePhase === 'manual' && (
        <div className="space-y-5 bg-neutral-950/70 p-5 rounded-xl border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              1. Physical Space Coordinates
            </span>
            {targetLocationCode && (
              <span className="text-xs font-mono font-bold bg-neutral-800 text-orange-300 px-2.5 py-1 rounded-md border border-neutral-700">
                Target: {targetLocationCode}
              </span>
            )}
          </div>

          {/* 4 Cascading Inputs: Area, Cabinet, Shelf, Stack */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Box 1: Track / Area */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">
                [Track / Area]
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={areaInput}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  placeholder="A-F"
                  maxLength={2}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm font-bold text-white uppercase focus:ring-1 focus:ring-orange-500 outline-none"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
                {/* Native hidden overlay select for dropdown list */}
                <select
                  value={areaInput}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Select Track / Area"
                >
                  {Object.keys(AREA_DEFINITIONS).map(areaKey => (
                    <option key={areaKey} value={areaKey} className="bg-neutral-900 text-white">
                      {AREA_DEFINITIONS[areaKey].name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-neutral-400 block truncate">
                {AREA_DEFINITIONS[areaInput.toUpperCase()]?.name || 'Custom Track'}
              </span>
            </div>

            {/* Box 2: Cabinet */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">
                [Cabinet]
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cabinetInput}
                  onChange={(e) => handleCabinetChange(e.target.value)}
                  placeholder="e.g. B1"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm font-bold text-white uppercase focus:ring-1 focus:ring-orange-500 outline-none"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
                <select
                  value={cabinetInput}
                  onChange={(e) => handleCabinetChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Select Cabinet"
                >
                  {availableCabinets.map(cab => (
                    <option key={cab} value={cab} className="bg-neutral-900 text-white">
                      Cabinet {cab}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-neutral-400 block">
                {cabinetInput.toUpperCase().startsWith('B') ? 'Unpartitioned Bay' : 'Partitioned Unit'}
              </span>
            </div>

            {/* Box 3: Shelf */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">
                [Shelf]
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shelfInput}
                  onChange={(e) => setShelfInput(e.target.value)}
                  placeholder="1-10"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm font-bold text-white focus:ring-1 focus:ring-orange-500 outline-none"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
                <select
                  value={shelfInput}
                  onChange={(e) => setShelfInput(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Select Shelf"
                >
                  {availableShelves.map(sh => {
                    const cab = (cabinetInput || '').toUpperCase().trim();
                    const isUnpart = cab.startsWith('B') || cab === 'C9';
                    return (
                      <option key={sh} value={sh} className="bg-neutral-900 text-white">
                        Shelf {sh} {isUnpart ? '(Single Bay)' : parseInt(sh) <= 5 ? '(Left / BOSS)' : '(Right / HUGO)'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <span className="text-[10px] text-neutral-400 block">
                {(cabinetInput.toUpperCase().startsWith('B') || cabinetInput.toUpperCase() === 'C9')
                  ? 'Single Bay (5 Shelves)'
                  : parseInt(shelfInput) <= 5 ? 'Pillar: BOSS' : 'Pillar: HUGO'}
              </span>
            </div>

            {/* Box 4: Stack */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">
                [Stack]
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={stackInput}
                  onChange={(e) => setStackInput(e.target.value)}
                  placeholder="1-5"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm font-bold text-white focus:ring-1 focus:ring-orange-500 outline-none"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
                <select
                  value={stackInput}
                  onChange={(e) => setStackInput(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Select Stack"
                >
                  {availableStacks.map(st => (
                    <option key={st} value={st} className="bg-neutral-900 text-white">
                      Stack {st} (26cm × 40cm)
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-neutral-400 block">
                Cap: {availableStacks.length} stacks
              </span>
            </div>
          </div>

          {/* Fourth Box: Organisation Logic */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
                2. Organisation Logic
              </label>
              <span className="text-[11px] text-neutral-400">
                Logged for AI Rule Digestion
              </span>
            </div>
            <textarea
              rows={3}
              value={logicText}
              onChange={(e) => setLogicText(e.target.value)}
              placeholder="Explain why this garment is placed here (e.g., Hugo Boss Autumn Polo collection, heavy knitwear shelf, fast-access merchandiser rack)..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:ring-1 focus:ring-orange-500 outline-none leading-relaxed"
            />
            <p className="text-[11px] text-neutral-400">
              * This rationale will be saved alongside the garment ID and timestamp to synthesize automated rules in the <strong>Warehouse Rules & Pattern</strong> tab.
            </p>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              statusMessage.type === 'success' 
                ? 'bg-green-950/50 border-green-700/60 text-green-300' 
                : 'bg-red-950/50 border-red-700/60 text-red-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Action Trigger */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Assigned By: <strong>Jennifer</strong></span>
            </div>

            <button
              type="button"
              onClick={handleAssign}
              disabled={submitting || !targetLocationCode}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning Space...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Space Assignment ({targetLocationCode || '—'})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
