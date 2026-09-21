import { useMemo } from 'react';
import { WarehouseLocationItem } from './types';
import { Box, Layers, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  cabinetNo: string;
  activeStack?: WarehouseLocationItem | null;
  locations?: WarehouseLocationItem[];
  onSelectStack?: (stack: WarehouseLocationItem) => void;
  compact?: boolean;
}

/**
 * CabinetSchematicDiagram
 * 
 * Renders an accurate, architectural CAD-style schematic diagram
 * mirroring the physical warehouse mobile rolling rack layouts:
 * - A3 & Standard (C1-C8, D, E, F): Dual-partition (Left: Shelves 1–5, Right: Shelves 6–10), 3 stacks/shelf (30 total)
 * - A1 & A2: Dual-partition (Left: Shelves 1–5, Right: Shelves 6–10), 2 stacks/shelf (20 total)
 * - B1–B10: Unpartitioned single bay, 5 shelves high, 5 stacks/shelf (25 total, or 20 if stack 5 closed)
 * - C9: Unpartitioned single bay, 5 shelves high, 3 stacks/shelf (15 total)
 */
export function CabinetSchematicDiagram({
  cabinetNo,
  activeStack,
  locations = [],
  onSelectStack,
  compact = false
}: Props) {
  const cleanCab = cabinetNo.toUpperCase().trim();
  const isA1A2 = cleanCab === 'A1' || cleanCab === 'A2';
  const isAreaB = cleanCab.startsWith('B');
  const isC9 = cleanCab === 'C9';
  const isUnpartitioned = isAreaB || isC9;

  const trackPrefix = cleanCab.charAt(0).toUpperCase();
  const trackNum = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(trackPrefix) + 1;

  // Build a lookup map by `${shelfNo}-${stackNo}`
  const locationMap = useMemo(() => {
    const map = new Map<string, WarehouseLocationItem>();
    locations.forEach(loc => {
      if (String(loc.cabinet_no).toUpperCase() === cleanCab) {
        map.set(`${loc.shelf_no}-${loc.stack_no}`, loc);
      }
    });
    return map;
  }, [locations, cleanCab]);

  // Determine geometry parameters
  const stacksPerRow = isA1A2 ? 2 : isAreaB ? 5 : 3;
  const shelvesPerCol = isUnpartitioned ? 5 : 5; // 5 shelf levels in dual partition or 5 shelves in single bay

  // Check if stack 5 is closed for Area B
  const isStack5Closed = isAreaB && locations.some(l => 
    String(l.cabinet_no).toUpperCase() === cleanCab && 
    l.stack_no === 5 && 
    (l.is_closed === 1 || l.is_active === 0)
  );

  const renderCell = (shelfNo: number, stackNo: number, isRightCol = false) => {
    const key = `${shelfNo}-${stackNo}`;
    const loc = locationMap.get(key);
    const isSelected = activeStack && activeStack.shelf_no === shelfNo && activeStack.stack_no === stackNo;
    const isClosed = isAreaB && stackNo === 5 && isStack5Closed;
    const count = loc?.current_count ?? 0;
    const max = loc?.max_capacity_units ?? 12;
    const isFull = loc?.is_full === 1 || (max > 0 && count >= max);
    const hasItems = count > 0;

    const brandPillar = isUnpartitioned ? 'General' : isRightCol ? 'HUGO' : 'BOSS';

    if (compact) {
      return (
        <button
          key={key}
          type="button"
          disabled={isClosed}
          onClick={() => loc && onSelectStack && onSelectStack(loc)}
          title={`Shelf ${shelfNo}, Stack ${stackNo} • ${loc?.location_code || `${cleanCab}-${shelfNo}-${stackNo}`} (${count}/${max})`}
          className={`relative rounded flex flex-col items-center justify-center transition-all cursor-pointer text-[10px] font-mono font-bold ${
            isClosed
              ? 'bg-neutral-900/60 text-neutral-600 border border-neutral-800/80 cursor-not-allowed opacity-50'
              : isSelected
              ? 'bg-amber-400 text-neutral-950 ring-2 ring-amber-300 ring-offset-1 ring-offset-neutral-950 font-black shadow-md z-10 scale-105'
              : hasItems
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-500 border border-neutral-800'
          } p-1 h-7 min-w-[28px]`}
        >
          <span>{stackNo}</span>
          {isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 absolute -top-0.5 -right-0.5 animate-ping" />
          )}
        </button>
      );
    }

    return (
      <button
        key={key}
        type="button"
        disabled={isClosed}
        onClick={() => loc && onSelectStack && onSelectStack(loc)}
        className={`group relative rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer border text-left ${
          isClosed
            ? 'bg-neutral-900/40 text-neutral-600 border-neutral-800/60 cursor-not-allowed'
            : isSelected
            ? 'bg-amber-400/15 border-amber-400 text-amber-200 ring-2 ring-amber-400/80 shadow-lg shadow-amber-950/40'
            : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700 text-neutral-300'
        } min-h-[76px]`}
      >
        <div className="flex items-center justify-between w-full">
          <span className={`text-xs font-mono font-black ${
            isSelected ? 'text-amber-400' : isClosed ? 'text-neutral-600' : 'text-neutral-200'
          }`}>
            {shelfNo}-{stackNo}
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
            isClosed
              ? 'bg-neutral-800 text-neutral-600'
              : isSelected
              ? 'bg-amber-400 text-neutral-950 font-bold'
              : isFull
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 font-bold'
              : hasItems
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-neutral-800/80 text-neutral-500'
          }`}>
            {isClosed ? 'CLOSED' : `${count}/${max}`}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className={`font-semibold ${
            isSelected ? 'text-amber-300' : isRightCol ? 'text-red-400' : isUnpartitioned ? 'text-blue-400' : 'text-neutral-400'
          }`}>
            {brandPillar}
          </span>
          <span className="text-neutral-500 font-mono text-[9px]">
            {loc?.location_code || `${cleanCab}-${shelfNo}-${stackNo}`}
          </span>
        </div>

        {/* Garment Capacity Mini Bar */}
        {!isClosed && (
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden mt-1.5">
            <div 
              className={`h-full ${isFull ? 'bg-red-500' : hasItems ? 'bg-amber-400' : 'bg-transparent'}`}
              style={{ width: `${Math.min(100, Math.round((count / (max || 1)) * 100))}%` }}
            />
          </div>
        )}
      </button>
    );
  };

  if (compact) {
    return (
      <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-neutral-400 border-b border-neutral-800/80 pb-1.5">
          <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" />
            Physical Locator: {cleanCab} • Track {trackPrefix}
          </span>
          <span className="font-mono text-neutral-500">
            {isUnpartitioned ? 'Single Bay (5 Shelves)' : isA1A2 ? 'Dual Partition (2 Stk)' : 'Dual Partition (3 Stk)'}
          </span>
        </div>

        {isUnpartitioned ? (
          /* Single bay compact 5 shelves stacked */
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(shelfNo => (
              <div key={shelfNo} className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono font-bold text-neutral-500 w-4 text-right">
                  S{shelfNo}
                </span>
                <div className="flex items-center gap-1 flex-1">
                  {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(shelfNo, idx + 1))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Dual partition compact: Left 1-5, Right 6-10 */
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2 text-[9px] text-center font-bold pb-0.5">
              <span className="text-neutral-400 font-mono">LEFT (S1–S5 BOSS)</span>
              <span className="text-red-400 font-mono">RIGHT (S6–S10 HUGO)</span>
            </div>
            {[1, 2, 3, 4, 5].map(leftShelfNo => {
              const rightShelfNo = leftShelfNo + 5;
              return (
                <div key={leftShelfNo} className="grid grid-cols-2 gap-2 items-center">
                  {/* Left Partition Row */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono font-bold text-neutral-500 w-3">
                      {leftShelfNo}
                    </span>
                    <div className="flex items-center gap-1 flex-1">
                      {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(leftShelfNo, idx + 1, false))}
                    </div>
                  </div>

                  {/* Right Partition Row */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono font-bold text-red-400/80 w-4 text-right">
                      {rightShelfNo}
                    </span>
                    <div className="flex items-center gap-1 flex-1">
                      {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(rightShelfNo, idx + 1, true))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 text-white rounded-3xl p-6 border border-neutral-800 space-y-6 shadow-2xl">
      {/* Schematic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-neutral-950 font-mono font-black text-xs">
              ARCHITECTURAL SCHEMATIC
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-xs">
              Floor Track {trackPrefix} (Set {trackNum || 1} of 6)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold text-xs">
              Single-Side Face Elevation
            </span>
            <h3 className="text-base font-bold font-mono text-white">
              Rolling Cabinet {cleanCab}
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Single-sided elevation view (direct aisle face). Rolling mobile carriage on <strong>Track {trackPrefix}</strong> (shared by all "{trackPrefix}"-prefix carriages). Opposing faces share the same mobile chassis (e.g. A1 and A2).
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
            <span className="text-neutral-400">BOSS Pillar (Left)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-red-400">HUGO Pillar (Right)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-amber-300">Selected / Active</span>
          </div>
        </div>
      </div>

      {/* Outer Physical Frame / Chassis */}
      <div className="border-4 border-neutral-700 bg-neutral-925 rounded-2xl p-5 relative shadow-inner">
        {/* Top Mechanical Track Label */}
        <div className="text-center text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-4 pb-2 border-b border-dashed border-neutral-800 flex items-center justify-center gap-2 flex-wrap">
          <span>▲ Overhead Roller Guide & Safety Railing</span>
          <span>•</span>
          <span className="text-cyan-300 font-bold">Face {cleanCab} (Track {trackPrefix} • Aisle View)</span>
          <span>•</span>
          <span>Floor Rail Track {trackPrefix} ▼</span>
        </div>

        {isUnpartitioned ? (
          /* UNPARTITIONED SINGLE-BAY (B1-B10 or C9) */
          <div className="space-y-4">
            <div className="bg-neutral-900/60 rounded-xl p-3 border border-neutral-800 text-xs flex items-center justify-between">
              <span className="font-bold text-blue-400 font-mono">
                {isAreaB ? 'AREA B UNPARTITIONED BAY (B1–B10)' : 'AREA C9 UNPARTITIONED BAY'}
              </span>
              <span className="text-neutral-400 font-mono text-[11px]">
                5 Shelves High • {stacksPerRow} Stacks Wide • Standard Depth (26cm × 40cm)
              </span>
            </div>

            {/* 5 Shelf Levels Stacked Vertically */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(shelfNo => (
                <div key={shelfNo} className="bg-neutral-900/90 rounded-2xl p-3 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-black text-amber-300 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
                      SHELF {shelfNo}
                    </span>
                    <span className="text-neutral-400 text-[11px]">
                      {isAreaB && shelfNo === 1 ? 'Top Level' : shelfNo === 5 ? 'Bottom Level' : `Level ${shelfNo}`}
                    </span>
                  </div>
                  <div className={`grid grid-cols-${stacksPerRow} gap-2`}>
                    {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(shelfNo, idx + 1))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* DUAL-PARTITIONED MOBILE UNIT (A1-A11, C1-C8, D, E, F) */
          <div className="space-y-4">
            {/* Partition Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-200" />
                  <span className="font-bold text-neutral-200 font-mono">LEFT VERTICAL BAY • Shelves 1 to 5</span>
                </div>
                <span className="text-neutral-400 font-mono text-[11px]">BOSS Pillar</span>
              </div>

              <div className="bg-neutral-900/80 rounded-xl p-3 border border-red-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="font-bold text-red-400 font-mono">RIGHT VERTICAL BAY • Shelves 6 to 10</span>
                </div>
                <span className="text-red-400/80 font-mono text-[11px]">HUGO Pillar</span>
              </div>
            </div>

            {/* 5 Physical Shelf Rows Side by Side with Central Divider */}
            <div className="space-y-3 relative">
              {/* Central Divider representation on medium+ screens */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-neutral-800 -translate-x-1/2 z-0 rounded-full" />

              {[1, 2, 3, 4, 5].map(leftShelfNo => {
                const rightShelfNo = leftShelfNo + 5;
                return (
                  <div key={leftShelfNo} className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {/* Left Partition Shelf */}
                    <div className="bg-neutral-900/90 rounded-2xl p-3 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-black text-amber-300 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
                          SHELF {leftShelfNo}
                        </span>
                        <span className="text-neutral-400 text-[10px]">
                          BOSS • 26cm × 40cm
                        </span>
                      </div>
                      <div className={`grid grid-cols-${stacksPerRow} gap-2`}>
                        {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(leftShelfNo, idx + 1, false))}
                      </div>
                    </div>

                    {/* Right Partition Shelf */}
                    <div className="bg-neutral-900/90 rounded-2xl p-3 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-black text-amber-300 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
                          SHELF {rightShelfNo}
                        </span>
                        <span className="text-red-400 text-[10px]">
                          HUGO • 26cm × 40cm
                        </span>
                      </div>
                      <div className={`grid grid-cols-${stacksPerRow} gap-2`}>
                        {Array.from({ length: stacksPerRow }, (_, idx) => renderCell(rightShelfNo, idx + 1, true))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Wheel Casters & Track Guide */}
        <div className="mt-5 pt-3 border-t border-dashed border-neutral-800 flex items-center justify-between text-[10px] font-mono text-neutral-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>● Caster Wheel A</span>
            <span>● Caster Wheel B</span>
          </div>
          <span className="text-emerald-400 font-bold">
            ▼ Floor Rail Track {trackPrefix} (Set {trackNum || 1} of 6 • All "{trackPrefix}" Carriages Roll on this Track) ▼
          </span>
          <div className="flex items-center gap-2">
            <span>● Caster Wheel C</span>
            <span>● Caster Wheel D</span>
          </div>
        </div>
      </div>
    </div>
  );
}
