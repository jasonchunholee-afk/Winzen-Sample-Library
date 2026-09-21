import { useState, useEffect } from 'react';
import { 
  Building2, Layers, PackageCheck, Box, Sparkles, MoveRight, 
  RotateCw, Plus, ShieldCheck, Printer, Camera, CheckCircle2 
} from 'lucide-react';
import { WarehouseLocationItem, UnshelfedGarmentItem } from './types';
import { WarehouseCabinetView } from './WarehouseCabinetView';
import { WarehouseBuilder } from './WarehouseBuilder';
import { WarehouseBatchShelvingModal } from './WarehouseBatchShelvingModal';
import { WarehouseAiFullnessModal } from './WarehouseAiFullnessModal';
import { WarehouseReallocateModal } from './WarehouseReallocateModal';
import { WarehouseRulesPattern } from './WarehouseRulesPattern';

interface Props {
  userRole?: string;
}

export function Warehouse({ userRole = 'Chen' }: Props) {
  const [activeTab, setActiveTab] = useState<'cabinet' | 'unshelfed' | 'builder' | 'rules'>('cabinet');
  const [selectedArea, setSelectedArea] = useState<string>('A');
  const [closeStack5InB, setCloseStack5InB] = useState<boolean>(false);
  const [isAreaInitializing, setIsAreaInitializing] = useState<boolean>(false);

  const [locations, setLocations] = useState<WarehouseLocationItem[]>([]);
  const [unshelfedItems, setUnshelfedItems] = useState<UnshelfedGarmentItem[]>([]);
  const [tempContainers, setTempContainers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [globalLogic, setGlobalLogic] = useState('');
  const [savingGlobalLogic, setSavingGlobalLogic] = useState(false);

  // Modals state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [inspectingLocation, setInspectingLocation] = useState<WarehouseLocationItem | null>(null);
  const [reallocatingLocation, setReallocatingLocation] = useState<WarehouseLocationItem | null>(null);

  const WAREHOUSE_AREAS = [
    { id: 'A', name: 'Track A', count: 11, desc: 'Track 1 of 6 • 11 Single-Side Faces (A1-A2 2-stacks, A3-A11 standard)' },
    { id: 'B', name: 'Track B', count: 10, desc: 'Track 2 of 6 • 10 Single-Side Faces (5 shelves, unpartitioned)' },
    { id: 'C', name: 'Track C', count: 9, desc: 'Track 3 of 6 • 9 Single-Side Faces (C1-C8 standard, C9 unpartitioned)' },
    { id: 'D', name: 'Track D', count: 11, desc: 'Track 4 of 6 • 11 Single-Side Faces (Standard 3-stacks)' },
    { id: 'E', name: 'Track E', count: 10, desc: 'Track 5 of 6 • 10 Single-Side Faces (Standard 3-stacks)' },
    { id: 'F', name: 'Track F', count: 8, desc: 'Track 6 of 6 • 8 Single-Side Faces (Standard 3-stacks)' },
    { id: 'ALL', name: 'All 6 Tracks', count: 59, desc: '6 Sets of Physical Floor Tracks • 59 Single-Side Faces Total' },
  ];

  const fetchLocations = async (area?: string) => {
    try {
      const targetArea = area !== undefined ? area : selectedArea;
      const query = targetArea && targetArea !== 'ALL' ? `?area=${encodeURIComponent(targetArea)}` : '';
      const res = await fetch(`/api/warehouse/locations${query}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.locations)) {
        setLocations(data.locations);
      }
    } catch (err) {
      console.error('Failed fetching warehouse locations:', err);
    }
  };

  const handleInitArea = async (areaId: string) => {
    setIsAreaInitializing(true);
    try {
      if (areaId === 'ALL') {
        const res = await fetch('/api/warehouse/builder/init-all-areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ closeStack5InB })
        });
        await res.json();
      } else {
        const res = await fetch('/api/warehouse/builder/init-bulk-area', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ areaCode: areaId, closeStack5InB })
        });
        await res.json();
      }
      await fetchLocations(areaId);
    } catch (err) {
      console.error('Failed initializing area:', err);
    } finally {
      setIsAreaInitializing(false);
    }
  };

  const fetchUnshelfed = async () => {
    try {
      const res = await fetch('/api/warehouse/unshelfed');
      const data = await res.json();
      if (data.success) {
        setUnshelfedItems(data.items || []);
        setTempContainers(data.tempContainers || ['Temp Box 1']);
      }
    } catch (err) {
      console.error('Failed fetching unshelfed garments:', err);
    }
  };

  const refreshAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchLocations(selectedArea), fetchUnshelfed()]);
    setIsLoading(false);
  };

  const handleSaveGlobalLogic = async () => {
    if (!globalLogic.trim()) return;
    setSavingGlobalLogic(true);
    try {
      await fetch('/api/warehouse/global-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logicText: globalLogic, assignedBy: userRole })
      });
      setGlobalLogic('');
      alert('Global Organisation Logic saved successfully.');
    } catch (err) {
      console.error('Failed to save global logic:', err);
      alert('Failed to save global logic.');
    } finally {
      setSavingGlobalLogic(false);
    }
  };

  useEffect(() => {
    fetchLocations(selectedArea);
  }, [selectedArea]);

  // Sync closeStack5InB with actual backend state for Area B
  useEffect(() => {
    if (selectedArea === 'B' && locations.length > 0) {
      const stack5s = locations.filter(l => l.stack_no === 5);
      if (stack5s.length > 0 && stack5s.every(l => l.is_closed === 1 || l.is_active === 0)) {
        setCloseStack5InB(true);
      } else if (stack5s.some(l => l.is_closed === 0 && l.is_active === 1)) {
        setCloseStack5InB(false);
      }
    }
  }, [selectedArea, locations]);

  useEffect(() => {
    fetchUnshelfed();
  }, []);

  const totalShelved = locations.reduce((sum, l) => sum + l.current_count, 0);
  const totalCapacity = locations.reduce((sum, l) => sum + l.max_capacity_units, 0);

  return (
    <div className="w-full px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      
      {/* Top Banner & Mode Switcher */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900">Warehouse Management</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Sprint 1 Rolling Cabinet
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Physical sample inventory, automated stack allocation & AI fullness inspection
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Chen's 20-batch button */}
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Chen's Batch Manifest ({unshelfedItems.length} unshelfed)</span>
          </button>

          <button
            type="button"
            onClick={refreshAll}
            disabled={isLoading}
            className="p-2.5 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Warehouse Data"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Shelved Samples</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-neutral-900 font-mono">{totalShelved}</span>
            <span className="text-xs text-neutral-500 font-mono">/ {totalCapacity} slots</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
            {totalCapacity > 0 ? Math.round((totalShelved / totalCapacity) * 100) : 0}% utilization
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Unshelfed in Temp Box</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-600 font-mono">{unshelfedItems.length}</span>
            <span className="text-xs text-neutral-400">awaiting cabinet</span>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold block mt-0.5">
            {unshelfedItems.length >= 20 ? 'Ready for 20-batch shelving!' : `${20 - unshelfedItems.length} to next 20 batch`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Active Rolling Cabinets</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-neutral-900 font-mono">
              {Array.from(new Set(locations.map(l => l.cabinet_no))).length || 1}
            </span>
            <span className="text-xs text-neutral-400">cabinets</span>
          </div>
          <span className="text-[11px] text-neutral-500 block mt-0.5 font-mono">
            {locations.length} stacks configured
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Brand Pillars</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">BOSS</span>
            <span className="text-xs font-bold text-neutral-900 bg-red-100 text-red-700 px-2 py-0.5 rounded">HUGO</span>
          </div>
          <span className="text-[10px] text-neutral-400 block mt-1">
            Permanent corporate architecture
          </span>
        </div>

      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('cabinet')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'cabinet'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>Rolling Cabinet Map & Inventory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unshelfed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'unshelfed'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Unshelfed Temp Queue ({unshelfedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Rules & Pattern</span>
        </button>

        {(userRole.toLowerCase() === 'jason' || userRole.toLowerCase() === 'developer') && (
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'builder'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Warehouse Builder</span>
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'cabinet' && (
        <div className="space-y-6">
          {/* Area Selector Tabs Strip */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2">
                  Warehouse Area:
                </span>
                {WAREHOUSE_AREAS.map(area => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedArea(area.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedArea === area.id
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <span>{area.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedArea === area.id ? 'bg-neutral-800 text-amber-300' : 'bg-neutral-200 text-neutral-600'
                    }`}>
                      {area.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Area Actions / B options */}
              <div className="flex items-center gap-2">
                {selectedArea === 'B' && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={closeStack5InB}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setCloseStack5InB(checked);
                        try {
                          await fetch('/api/warehouse/builder/toggle-stack5', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              areaId: 'B',
                              close: checked
                            })
                          });
                          await fetchLocations(selectedArea);
                        } catch (err) {
                          console.error('Failed toggling Stack 5:', err);
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Close Stack 5 (4 Stacks Mode)</span>
                  </label>
                )}

                {(userRole.toLowerCase() === 'jason' || userRole.toLowerCase() === 'developer') && (
                  <button
                    type="button"
                    onClick={() => handleInitArea(selectedArea)}
                    disabled={isAreaInitializing}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title="Initialize or reset this area"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isAreaInitializing ? 'animate-spin' : ''}`} />
                    <span>{locations.length === 0 ? `Initialize ${selectedArea === 'ALL' ? 'All Areas' : `Area ${selectedArea}`}` : `Reset ${selectedArea === 'ALL' ? 'All' : `Area ${selectedArea}`}`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Selected Area Description & Track Architecture Banner */}
            <div className="space-y-2 border-t border-neutral-100 pt-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-600 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Physical Track Architecture:
                  </span>
                  <span>
                    6 sets of floor tracks (A to F). All "{selectedArea === 'ALL' ? 'A–F' : selectedArea}"-prefix cabinets roll along {selectedArea === 'ALL' ? 'their respective floor tracks' : `Track ${selectedArea}`}.
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  Single-side elevation faces
                </span>
              </div>

              <div className="text-[11px] text-neutral-500 flex items-center justify-between px-1">
                <span>
                  {WAREHOUSE_AREAS.find(a => a.id === selectedArea)?.desc}
                </span>
                <span className="font-mono text-neutral-400">
                  {locations.length} stacks active
                </span>
              </div>
            </div>
          </div>

          {/* Global Organisation Logic Input */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                Global Organisation Logic
              </label>
            </div>
            <textarea
              rows={2}
              value={globalLogic}
              onChange={(e) => setGlobalLogic(e.target.value)}
              placeholder="Define high-level warehouse rules (e.g., 'Area B is strictly for heavy knitwear. Hugo items must always go to the right-side stacks (Shelves 6-10)...')"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-1 focus:ring-orange-500 outline-none leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveGlobalLogic}
                disabled={savingGlobalLogic || !globalLogic.trim()}
                className="px-4 py-2 bg-neutral-900 hover:bg-black active:bg-neutral-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {savingGlobalLogic ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Global Rule for AI Digestion</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* If Area has 0 locations, show dedicated Initializer banner */}
          {locations.length === 0 ? (
            <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <Box className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  {selectedArea === 'ALL' ? 'Warehouse Has No Configured Locations' : `Area ${selectedArea} Not Yet Built`}
                </h3>
                <p className="text-xs text-neutral-500">
                  {WAREHOUSE_AREAS.find(a => a.id === selectedArea)?.desc}. Build this area instantly using the optimized bulk engine.
                </p>
              </div>
              {(userRole.toLowerCase() === 'jason' || userRole.toLowerCase() === 'developer') && (
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleInitArea(selectedArea)}
                    disabled={isAreaInitializing}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <RotateCw className={`w-4 h-4 ${isAreaInitializing ? 'animate-spin' : ''}`} />
                    <span>Initialize {selectedArea === 'ALL' ? 'All 6 Areas' : `Area ${selectedArea}`}</span>
                  </button>
                  {selectedArea !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleInitArea('ALL')}
                      disabled={isAreaInitializing}
                      className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      <span>Initialize All 6 Areas (A-F)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <WarehouseCabinetView
              locations={locations}
              onOpenAiInspect={(loc) => setInspectingLocation(loc)}
              onOpenReallocate={(loc) => setReallocatingLocation(loc)}
              onRefresh={refreshAll}
            />
          )}
        </div>
      )}

      {activeTab === 'unshelfed' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Unshelfed Garments (Temp Box / Bag)</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Garments freshly photographed in Capture Station awaiting physical placement into the rolling cabinet
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 text-amber-400" />
              <span>Launch 20-Batch Shelving Manifest</span>
            </button>
          </div>

          {unshelfedItems.length === 0 ? (
            <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-neutral-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-neutral-800">All garments are currently shelved!</p>
              <p className="text-xs text-neutral-400">Newly captured garments will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {unshelfedItems.map((item, idx) => (
                <div key={item.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-2">
                  <div className="relative">
                    {item.thumb_url ? (
                      <img 
                        src={item.thumb_url} 
                        alt={item.id} 
                        className="w-full h-36 object-cover rounded-lg bg-white border border-neutral-200"
                      />
                    ) : (
                      <div className="w-full h-36 bg-neutral-200 rounded-lg flex items-center justify-center text-neutral-400 text-xs font-mono">
                        No image
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[10px] font-bold">
                      #{idx + 1}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold font-mono text-neutral-900 block truncate">{item.id}</span>
                    <span className="text-[11px] text-neutral-500 block truncate">
                      {item.buyer || 'Unknown'} • {item.garment_type || 'Apparel'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-[11px]">
                    <span className="text-amber-700 bg-amber-100 font-medium px-1.5 py-0.5 rounded text-[10px]">
                      {item.temp_container || 'Temp Box 1'}
                    </span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px]">
                      {item.assigned_location || 'CAB1-SH1-STK1'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'builder' && (
        <WarehouseBuilder
          onCabinetBuilt={refreshAll}
          currentLocations={locations}
        />
      )}

      {activeTab === 'rules' && (
        <WarehouseRulesPattern />
      )}

      {/* Batch Shelving Manifest Modal */}
      <WarehouseBatchShelvingModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        unshelfedItems={unshelfedItems}
        onBatchShelved={refreshAll}
      />

      {/* AI Fullness Inspector Modal */}
      <WarehouseAiFullnessModal
        isOpen={Boolean(inspectingLocation)}
        onClose={() => setInspectingLocation(null)}
        location={inspectingLocation}
        onInspectionApplied={refreshAll}
      />

      {/* Reallocate Garments Modal */}
      <WarehouseReallocateModal
        isOpen={Boolean(reallocatingLocation)}
        onClose={() => setReallocatingLocation(null)}
        sourceLocation={reallocatingLocation}
        allLocations={locations}
        onReallocated={refreshAll}
      />

    </div>
  );
}
