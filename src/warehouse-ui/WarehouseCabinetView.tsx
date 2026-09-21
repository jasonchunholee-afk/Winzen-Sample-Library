import { useState } from 'react';
import { 
  Layers, Sparkles, MoveRight, Eye, Camera, CheckCircle2, 
  AlertCircle, ChevronRight, Package, Box, Tag, ShieldCheck,
  Grid, LayoutGrid, List, MapPin, Compass
} from 'lucide-react';
import { WarehouseLocationItem, WarehouseGarment } from './types';
import { CabinetSchematicDiagram } from './CabinetSchematicDiagram';

interface Props {
  locations: WarehouseLocationItem[];
  onOpenAiInspect: (loc: WarehouseLocationItem) => void;
  onOpenReallocate: (loc: WarehouseLocationItem) => void;
  onRefresh: () => Promise<void>;
}

export function WarehouseCabinetView({ locations, onOpenAiInspect, onOpenReallocate, onRefresh }: Props) {
  // Available cabinets sorted naturally (e.g. A1, A2... A10, A11)
  const availableCabinets = Array.from(
    new Set(locations.map(l => String(l.cabinet_no || '')).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (availableCabinets.length === 0 && locations.length === 0) {
    availableCabinets.push('A1');
  }

  const [selectedCabinet, setSelectedCabinet] = useState<string>('A1');
  const [activeStack, setActiveStack] = useState<WarehouseLocationItem | null>(null);
  const [viewMode, setViewMode] = useState<'blueprint' | 'schematic' | 'shelves'>('blueprint');
  const [isTogglingStack5, setIsTogglingStack5] = useState<boolean>(false);

  // Guard against stale cabinet selection when changing areas
  const effectiveCabinet = availableCabinets.includes(selectedCabinet)
    ? selectedCabinet
    : (availableCabinets[0] || 'A1');

  // Filter locations for selected cabinet
  const cabinetLocations = locations.filter(l => String(l.cabinet_no) === effectiveCabinet);
  
  // Group by shelf_no
  const shelvesMap = new Map<number, WarehouseLocationItem[]>();
  cabinetLocations.forEach(loc => {
    if (!shelvesMap.has(loc.shelf_no)) {
      shelvesMap.set(loc.shelf_no, []);
    }
    shelvesMap.get(loc.shelf_no)!.push(loc);
  });

  const shelves = Array.from(shelvesMap.entries()).sort((a, b) => a[0] - b[0]);
  
  // Physical Architectural Constraints (User Specs 3.1, 3.2, 3.3)
  const isA1A2 = effectiveCabinet === 'A1' || effectiveCabinet === 'A2';
  const isAreaB = effectiveCabinet.startsWith('B');
  const isC9 = effectiveCabinet === 'C9';
  const isUnpartitioned = isAreaB || isC9 || cabinetLocations.some(l => l.is_partitioned === 0);
  const isDualPartition = !isUnpartitioned && shelves.length >= 6;

  // Check if stack 5 in this cabinet is currently closed or missing
  const stack5Locations = cabinetLocations.filter(l => l.stack_no === 5);
  const hasStack5Closed = isAreaB && (
    stack5Locations.length === 0 || 
    stack5Locations.some(l => l.is_closed === 1 || l.is_active === 0)
  );

  const handleToggleStack5 = async () => {
    setIsTogglingStack5(true);
    try {
      const willClose = !hasStack5Closed;
      await fetch('/api/warehouse/builder/toggle-stack5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabinetNo: effectiveCabinet,
          close: willClose
        })
      });
      await onRefresh();
    } catch (err) {
      console.error('Failed toggling stack 5:', err);
    } finally {
      setIsTogglingStack5(false);
    }
  };

  const toggleAssignmentMode = async (stack: WarehouseLocationItem) => {
    try {
      const newMode = stack.assignment_mode === 'Auto' ? 'Manual' : 'Auto';
      await fetch(`/api/warehouse/locations/${stack.location_code}/mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentMode: newMode })
      });
      await onRefresh();
    } catch (err) {
      console.error('Failed toggling mode:', err);
    }
  };

  const totalGarmentsInCabinet = cabinetLocations.reduce((acc, l) => acc + l.current_count, 0);
  const totalCapacityInCabinet = cabinetLocations.reduce((acc, l) => acc + l.max_capacity_units, 0);

  // Helper to render an individual stack cell
  const renderStackTile = (stack: WarehouseLocationItem) => {
    const isClosed = stack.is_closed === 1 || stack.fullness_level === 'CLOSED';
    const pct = Math.round((stack.current_count / (stack.max_capacity_units || 1)) * 100);
    const isFull = stack.is_full === 1 || stack.fullness_level === 'FULL';
    const isNearFull = !isFull && (stack.fullness_level === 'NEAR_FULL' || pct >= 75);
    const isBoss = (stack.assigned_buyer || '').toUpperCase().includes('BOSS');
    const isHugo = (stack.assigned_buyer || '').toUpperCase().includes('HUGO');

    if (isClosed) {
      return (
        <div 
          key={stack.id}
          id={`stack-${stack.location_code}`}
          className={`bg-neutral-900/60 rounded-xl p-3 border border-dashed border-neutral-700/60 flex flex-col justify-between opacity-80 hover:opacity-100 transition-all cursor-pointer ${
            activeStack?.id === stack.id ? 'ring-2 ring-amber-400 border-amber-400' : ''
          }`}
          onClick={() => setActiveStack(stack)}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-black font-mono text-neutral-500 line-through">
                {stack.shelf_no}-{stack.stack_no}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-neutral-800 text-neutral-400 border border-neutral-700">
                CLOSED BUFFER
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-medium my-2">
              Stack 5 Closed (4-Stack Mode)
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              26cm W × 40cm D slot reserved
            </div>
          </div>
          <div className="pt-2 border-t border-neutral-800/80 text-[10px] flex items-center justify-between">
            <span className="text-neutral-500 font-mono">Tight fit buffer</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleStack5();
              }}
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Re-open
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={stack.id}
        id={`stack-${stack.location_code}`}
        className={`bg-neutral-900 rounded-xl p-3 border transition-all cursor-pointer hover:border-amber-400/80 flex flex-col justify-between ${
          activeStack?.id === stack.id 
            ? 'ring-2 ring-amber-400 border-amber-400 bg-neutral-850' 
            : 'border-neutral-800 hover:bg-neutral-850/60'
        }`}
        onClick={() => setActiveStack(stack)}
      >
        {/* Top Header: [shelf]-[stack] badge & occupancy */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black font-mono text-amber-300 tracking-tight">
                {stack.shelf_no}-{stack.stack_no}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                ({stack.location_code})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono border border-neutral-700/60" title="Garment Width: 26cm, Depth: 40cm">
                26×40cm
              </span>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); toggleAssignmentMode(stack); }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono border cursor-pointer transition-colors ${
                  stack.assignment_mode === 'Auto' 
                    ? 'bg-purple-900/40 text-purple-300 border-purple-700/50 hover:bg-purple-800/60' 
                    : 'bg-orange-900/40 text-orange-300 border-orange-700/50 hover:bg-orange-800/60'
                }`}
                title="Toggle between Manual Assignment and AI Auto-Shelving mode"
              >
                {stack.assignment_mode === 'Auto' ? 'AUTO' : 'MANUAL'}
              </button>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                isFull 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : isNearFull 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isFull ? 'FULL' : `${stack.current_count}/${stack.max_capacity_units}`}
              </span>
            </div>
          </div>

          {/* Customer & Type Label */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
              isHugo 
                ? 'bg-red-950 text-red-300 border border-red-800' 
                : isBoss 
                ? 'bg-neutral-800 text-neutral-200 border border-neutral-700' 
                : 'bg-neutral-800 text-neutral-400'
            }`}>
              {stack.assigned_buyer || 'General'}
            </span>
            <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
              {stack.assigned_type || 'All'}
            </span>
          </div>

          {/* Capacity Progress Bar */}
          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-2.5">
            <div 
              className={`h-full transition-all ${
                isFull ? 'bg-red-500' : isNearFull ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>

          {/* Garments Visual preview thumbnails */}
          <div className="flex items-center gap-1 overflow-hidden h-9 mb-2">
            {stack.garments.length === 0 ? (
              <div className="text-[10px] text-neutral-500 italic">Empty stack</div>
            ) : (
              stack.garments.slice(0, 4).map((g, idx) => (
                g.thumb_url ? (
                  <img 
                    key={g.id || idx}
                    src={g.thumb_url} 
                    alt={g.id}
                    className="w-8 h-8 rounded-md object-cover border border-neutral-700 shrink-0 bg-neutral-800"
                  />
                ) : (
                  <div 
                    key={g.id || idx}
                    className="w-8 h-8 rounded-md bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[8px] text-neutral-400 shrink-0 font-mono"
                  >
                    {g.id.slice(-3)}
                  </div>
                )
              ))
            )}
            {stack.garments.length > 4 && (
              <span className="text-[9px] text-neutral-400 font-bold ml-1">
                +{stack.garments.length - 4}
              </span>
            )}
          </div>

          {/* Pending indicator */}
          {stack.pending_assigned_count > 0 && (
            <div className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mb-2 font-medium">
              +{stack.pending_assigned_count} in Temp Box
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[10px]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenAiInspect(stack); }}
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Inspect</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenReallocate(stack); }}
            className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <MoveRight className="w-3 h-3" />
            <span>Move</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Cabinet Selector Tabs & Layout Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1">
            Active Cart:
          </span>
          {availableCabinets.map(cabId => (
            <button
              key={cabId}
              type="button"
              id={`btn-select-cabinet-${cabId}`}
              onClick={() => { setSelectedCabinet(cabId); setActiveStack(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                effectiveCabinet === cabId
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Cabinet {cabId}
            </button>
          ))}
        </div>

        {/* View Switcher & Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => setViewMode('blueprint')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'blueprint'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Physical Blueprint</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('schematic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'schematic'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-500" />
              <span>Schematic Diagram</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('shelves')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'shelves'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Shelf Rows</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-neutral-600">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-neutral-600">Near Full</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-neutral-600">Full</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Rolling Cabinet Physical Grid */}
      <div className="bg-neutral-950 text-white rounded-3xl p-6 shadow-xl border border-neutral-800 space-y-6">
        
        {/* Cabinet Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-amber-400 shadow-inner">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white font-mono">Rolling Cabinet {effectiveCabinet}</h3>
                {isA1A2 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Space-Constrained Unit • 2 Stacks / Shelf • 10 Shelves
                  </span>
                )}
                {isAreaB && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Unpartitioned Bay • {hasStack5Closed ? '4 Stacks (Stack 5 Closed)' : '5 Stacks (Tight Fit)'} • 5 Shelves
                  </span>
                )}
                {isC9 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Unpartitioned Bay • 3 Stacks / Shelf • 5 Shelves
                  </span>
                )}
                {!isA1A2 && !isAreaB && !isC9 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Standard 2-Partition Mobile Unit • 3 Stacks / Shelf • 10 Shelves
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-300 bg-neutral-800 border border-neutral-700">
                  Garment: 26cm W × 40cm D
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Floor Track {effectiveCabinet.charAt(0).toUpperCase()} (Set {['A', 'B', 'C', 'D', 'E', 'F'].indexOf(effectiveCabinet.charAt(0).toUpperCase()) + 1 || 1} of 6)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Single-Side Elevation (Aisle Face)
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {isA1A2 ? (
                  `Dual vertical partitions • 5 shelves left (1–5) + 5 shelves right (6–10) • 2 stacks per shelf • Code format: [${effectiveCabinet}]-[shelf]-[stack]`
                ) : isAreaB ? (
                  `Unpartitioned single bay (no vertical divider) • 5 full-width shelves • 5 stacks per shelf (tight fit, stack 5 may be closed) • Code format: [${effectiveCabinet}]-[shelf]-[stack]`
                ) : isC9 ? (
                  `Unpartitioned single bay (no vertical divider) • 5 full-width shelves • 3 stacks per shelf • Code format: [${effectiveCabinet}]-[shelf]-[stack]`
                ) : (
                  `Dual vertical partitions • 5 shelves left (1–5) + 5 shelves right (6–10) • 3 stacks per shelf • Code format: [${effectiveCabinet}]-[shelf]-[stack]`
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-cyan-400/90 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Physical Track Architecture: Mobile carriage on Track {effectiveCabinet.charAt(0).toUpperCase()} (shared by all "{effectiveCabinet.charAt(0).toUpperCase()}"-prefix carriages). Each code represents one direct aisle face (e.g. A1 and A2 are opposing faces of the same chassis).</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Quick Stack 5 Toggle for Area B Cabinets */}
            {isAreaB && (
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-semibold text-neutral-300">Stack 5:</span>
                <button
                  type="button"
                  onClick={handleToggleStack5}
                  disabled={isTogglingStack5}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                    hasStack5Closed
                      ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-xs'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                  title={hasStack5Closed ? 'Open Stack 5 (Use 5 stacks per shelf)' : 'Close Stack 5 (Use 4 stacks per shelf)'}
                >
                  {isTogglingStack5 ? 'Updating...' : hasStack5Closed ? 'Closed (4 Stacks)' : 'Open (5 Stacks - Tight)'}
                </button>
              </div>
            )}

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Shelved</span>
              <span className="text-lg font-mono font-bold text-amber-400">
                {totalGarmentsInCabinet} <span className="text-xs text-neutral-400 font-normal">/ {totalCapacityInCabinet} slots</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Utilization</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                {totalCapacityInCabinet > 0 ? Math.round((totalGarmentsInCabinet / totalCapacityInCabinet) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* VIEW 1: Architectural Schematic Diagram */}
        {viewMode === 'schematic' ? (
          <CabinetSchematicDiagram 
            cabinetNo={effectiveCabinet}
            activeStack={activeStack}
            locations={cabinetLocations}
            onSelectStack={(stk) => setActiveStack(stk)}
          />
        ) : viewMode === 'blueprint' ? (
          isDualPartition ? (
            /* DUAL-PARTITION BLUEPRINT (A1-A2: 2 stacks, A3-A11, C1-C8, D, E, F: 3 stacks) */
            <div className="space-y-4">
              {/* Partition Column Labels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 border-b border-neutral-800 text-xs">
                <div className="flex items-center justify-between px-2 text-neutral-300 font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-200" />
                    <span>LEFT VERTICAL PARTITION • Shelves 1 to 5</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {isA1A2 ? '2 Stacks / Shelf' : '3 Stacks / Shelf'} • BOSS
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 text-red-300 font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>RIGHT VERTICAL PARTITION • Shelves 6 to 10</span>
                  </div>
                  <span className="text-[11px] font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/50">
                    {isA1A2 ? '2 Stacks / Shelf' : '3 Stacks / Shelf'} • HUGO
                  </span>
                </div>
              </div>

              {/* 5 Rows corresponding to the 5 shelf levels side-by-side */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(leftShelfNo => {
                  const rightShelfNo = leftShelfNo + 5;
                  const leftStacks = (shelvesMap.get(leftShelfNo) || []).sort((a, b) => a.stack_no - b.stack_no);
                  const rightStacks = (shelvesMap.get(rightShelfNo) || []).sort((a, b) => a.stack_no - b.stack_no);

                  return (
                    <div key={leftShelfNo} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                      
                      {/* Left Partition Shelf */}
                      <div className="bg-neutral-900/90 rounded-2xl p-3.5 border border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono font-bold border border-neutral-700">
                              SHELF {leftShelfNo}
                            </span>
                            <span className="text-neutral-300 font-semibold truncate max-w-[140px]">
                              {leftStacks[0]?.assigned_type || 'BOSS'}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {leftStacks.reduce((s, stk) => s + stk.current_count, 0)} garments
                          </span>
                        </div>

                        <div className={`grid ${isA1A2 ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                          {leftStacks.map(stack => renderStackTile(stack))}
                        </div>
                      </div>

                      {/* Right Partition Shelf */}
                      <div className="bg-neutral-900/90 rounded-2xl p-3.5 border border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono font-bold border border-neutral-700">
                              SHELF {rightShelfNo}
                            </span>
                            <span className="text-red-300 font-semibold truncate max-w-[140px]">
                              {rightStacks[0]?.assigned_type || 'HUGO'}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {rightStacks.reduce((s, stk) => s + stk.current_count, 0)} garments
                          </span>
                        </div>

                        <div className={`grid ${isA1A2 ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                          {rightStacks.map(stack => renderStackTile(stack))}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* UNPARTITIONED SINGLE-BAY BLUEPRINT (B1-B10: 5 stacks or 4 if closed, C9: 3 stacks) */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs px-2">
                <div className="flex items-center gap-2 text-neutral-300 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span>UNPARTITIONED SINGLE-BAY ARCHITECTURE • Shelves 1 to {shelves.length} Stacked Vertically</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {isAreaB 
                    ? `5 Stacks / Shelf (Tight Fit) ${hasStack5Closed ? '• Stack 5 Closed' : ''}` 
                    : '3 Stacks / Shelf (No Vertical Partition)'}
                </span>
              </div>

              {/* Full-Width Horizontal Shelves Stacked */}
              <div className="space-y-3">
                {shelves.map(([shelfNo, stackList]) => {
                  const sortedStacks = [...stackList].sort((a, b) => a.stack_no - b.stack_no);
                  const shelfBuyer = sortedStacks[0]?.assigned_buyer || 'General';
                  const shelfType = sortedStacks[0]?.assigned_type || 'All';

                  return (
                    <div 
                      key={shelfNo}
                      className="bg-neutral-900/90 rounded-2xl p-3.5 border border-neutral-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono font-bold border border-neutral-700">
                            SHELF {shelfNo}
                          </span>
                          <span className="text-neutral-300 font-semibold">
                            {shelfBuyer}
                          </span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-400">
                            {shelfType}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            (Single Bay • 26cm W × 40cm D)
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {sortedStacks.reduce((s, stk) => s + stk.current_count, 0)} garments
                        </span>
                      </div>

                      {/* Responsive Grid for Stacks */}
                      <div className={`grid ${
                        isAreaB 
                          ? (hasStack5Closed ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')
                          : 'grid-cols-1 sm:grid-cols-3'
                      } gap-2`}>
                        {sortedStacks.map(stack => renderStackTile(stack))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* VIEW 2: Standard Shelves List View */
          <div className="space-y-4">
            {shelves.map(([shelfNo, stackList]) => {
              const sortedStacks = [...stackList].sort((a, b) => a.stack_no - b.stack_no);
              const shelfBuyer = sortedStacks[0]?.assigned_buyer || 'Mixed';
              const shelfType = sortedStacks[0]?.assigned_type || 'All';

              return (
                <div 
                  key={shelfNo} 
                  className="bg-neutral-900/90 rounded-2xl p-4 border border-neutral-800 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-neutral-800 text-amber-300 font-mono font-bold text-xs border border-neutral-700">
                        SHELF {shelfNo}
                      </span>
                      <span className="text-neutral-200 font-bold">
                        {shelfBuyer}
                      </span>
                      <span className="text-neutral-500">•</span>
                      <span className="text-neutral-400">
                        {shelfType}
                      </span>
                      <span className="text-neutral-500 text-[10px] font-mono">
                        {isUnpartitioned ? '(Single Bay)' : (shelfNo <= 5 ? '(Partition: Left 1–5)' : '(Partition: Right 6–10)')}
                      </span>
                    </div>

                    <span className="text-[11px] text-neutral-400 font-mono">
                      {sortedStacks.reduce((sum, s) => sum + s.current_count, 0)} garments placed
                    </span>
                  </div>

                  <div className={`grid ${
                    isAreaB 
                      ? (hasStack5Closed ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5')
                      : isA1A2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                  } gap-3`}>
                    {sortedStacks.map(stack => renderStackTile(stack))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Stack Details Drawer when clicked */}
      {activeStack && (
        <div id="stack-inspection-drawer" className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-neutral-950 font-mono font-black text-xs">
                  {activeStack.location_code}
                </span>
                <h4 className="text-base font-bold text-neutral-900">{activeStack.location_name}</h4>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Brand Pillar: <span className="font-bold text-neutral-900">{activeStack.assigned_buyer || 'General'}</span> • Category: <span className="font-bold text-neutral-900">{activeStack.assigned_type || 'All'}</span> • Capacity: <span className="font-bold text-neutral-900">{activeStack.current_count} / {activeStack.max_capacity_units}</span> units
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold border border-neutral-200">
                  Garment Width: {activeStack.stack_width_cm || 26} cm
                </span>
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold border border-neutral-200">
                  Garment Depth: {activeStack.stack_depth_cm || 40} cm
                </span>
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold border border-neutral-200">
                  {isUnpartitioned ? 'Single Bay (No Vertical Divider)' : (activeStack.shelf_no <= 5 ? 'Left Partition' : 'Right Partition')}
                </span>
                {activeStack.is_closed === 1 ? (
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200">
                    Slot Status: Closed Buffer (4-Stack Mode)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">
                    Slot Status: Active
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-drawer-ai-inspect"
                onClick={() => onOpenAiInspect(activeStack)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-indigo-200 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI Fullness Inspection</span>
              </button>

              <button
                type="button"
                id="btn-drawer-move-garments"
                onClick={() => onOpenReallocate(activeStack)}
                className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-neutral-300 cursor-pointer"
              >
                <MoveRight className="w-4 h-4 text-neutral-600" />
                <span>Rearrange Garments</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStack(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* AI Inspection Notes if any */}
          {activeStack.full_evidence_notes && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-indigo-950">AI Inspection Log</span>
                <p className="mt-0.5 text-indigo-800">{activeStack.full_evidence_notes}</p>
                {activeStack.last_inspected_at && (
                  <span className="text-[10px] text-indigo-500 mt-1 block">
                    Last inspected: {new Date(activeStack.last_inspected_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Physical Cabinet Locator Diagram */}
          <div>
            <CabinetSchematicDiagram
              cabinetNo={effectiveCabinet}
              activeStack={activeStack}
              locations={cabinetLocations}
              onSelectStack={(stk) => setActiveStack(stk)}
              compact={true}
            />
          </div>

          {/* Shelved Garments Grid */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-700">
              Garments Shelved in Stack {activeStack.shelf_no}-{activeStack.stack_no} ({activeStack.garments.length} units):
            </span>

            {activeStack.garments.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 rounded-xl border border-dashed border-neutral-300 text-xs text-neutral-500">
                This stack is currently empty. Place garments here via Chen's 20-batch shelving manifest.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {activeStack.garments.map(g => (
                  <div key={g.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-center space-y-1.5">
                    {g.thumb_url ? (
                      <img 
                        src={g.thumb_url} 
                        alt={g.id} 
                        className="w-full h-24 object-cover rounded-lg bg-white border border-neutral-200"
                      />
                    ) : (
                      <div className="w-full h-24 bg-neutral-200 rounded-lg flex items-center justify-center text-neutral-400 text-xs font-mono">
                        No img
                      </div>
                    )}
                    <span className="text-xs font-bold font-mono text-neutral-900 block truncate">
                      {g.id}
                    </span>
                    <span className="text-[10px] text-neutral-500 block truncate">
                      {g.buyer || 'Apparel'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
