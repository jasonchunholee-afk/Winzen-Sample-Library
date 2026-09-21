import { useState } from 'react';
import { 
  Building2, Layers, Grid3X3, CheckCircle2, ShieldCheck, 
  Sparkles, Save, RotateCcw, Info, ArrowRight, Loader2 
} from 'lucide-react';
import { WarehouseLocationItem } from './types';

interface Props {
  onCabinetBuilt: () => Promise<void>;
  currentLocations: WarehouseLocationItem[];
}

export function WarehouseBuilder({ onCabinetBuilt, currentLocations }: Props) {
  const [cabinetNo, setCabinetNo] = useState('A3');
  const [shelvesCount, setShelvesCount] = useState(10);
  const [stacksPerShelf, setStacksPerShelf] = useState(3);
  const [preset, setPreset] = useState<'HUGO_BOSS_STANDARD' | 'CUSTOM'>('HUGO_BOSS_STANDARD');
  
  // Custom shelf definitions
  const [shelfConfigs, setShelfConfigs] = useState([
    { shelfNo: 1, buyer: 'BOSS', type: 'Polo / T-Shirt', capacity: 16 },
    { shelfNo: 2, buyer: 'BOSS', type: 'Sweaters & Knitwear', capacity: 14 },
    { shelfNo: 3, buyer: 'BOSS', type: 'Pants / Bottoms', capacity: 14 },
    { shelfNo: 4, buyer: 'BOSS', type: 'Jacket / Outerwear', capacity: 6 },
    { shelfNo: 5, buyer: 'BOSS', type: 'Suiting / Tailoring', capacity: 6 },
    { shelfNo: 6, buyer: 'HUGO', type: 'Graphic Tees & Polos', capacity: 16 },
    { shelfNo: 7, buyer: 'HUGO', type: 'Hoodies & Sweatshirts', capacity: 12 },
    { shelfNo: 8, buyer: 'HUGO', type: 'Denim & Street Pants', capacity: 14 },
    { shelfNo: 9, buyer: 'HUGO', type: 'Casual Jackets & Outerwear', capacity: 8 },
    { shelfNo: 10, buyer: 'Overflow / General', type: 'Archive & Overflow', capacity: 14 },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelectPresetCabinet = (cab: string) => {
    setCabinetNo(cab);
    if (cab === 'A1' || cab === 'A2') {
      handleShelvesCountChange(10);
      setStacksPerShelf(2);
    } else if (cab.startsWith('B')) {
      handleShelvesCountChange(5);
      setStacksPerShelf(5);
    } else if (cab === 'C9') {
      handleShelvesCountChange(5);
      setStacksPerShelf(3);
    } else {
      handleShelvesCountChange(10);
      setStacksPerShelf(3);
    }
  };

  const handleShelvesCountChange = (count: number) => {
    setShelvesCount(count);
    const newConfigs = [];
    for (let i = 1; i <= count; i++) {
      const existing = shelfConfigs.find(c => c.shelfNo === i);
      if (existing) {
        newConfigs.push(existing);
      } else {
        newConfigs.push({
          shelfNo: i,
          buyer: i <= 5 ? 'BOSS' : i <= 9 ? 'HUGO' : 'Overflow / General',
          type: 'All Garments',
          capacity: 12
        });
      }
    }
    setShelfConfigs(newConfigs);
  };

  const handleUpdateShelfConfig = (index: number, key: string, value: any) => {
    setShelfConfigs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleBuildCabinet = async () => {
    try {
      setIsSaving(true);
      setFeedback(null);

      // Map custom rules for each stack
      const customRules: any[] = [];
      shelfConfigs.forEach(sc => {
        for (let stk = 1; stk <= stacksPerShelf; stk++) {
          customRules.push({
            shelfNo: sc.shelfNo,
            stackNo: stk,
            buyer: sc.buyer,
            type: sc.type,
            capacity: Number(sc.capacity)
          });
        }
      });

      const res = await fetch('/api/warehouse/builder/init-cabinet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cabinetNo,
          shelvesCount,
          stacksPerShelf,
          preset,
          customRules: preset === 'CUSTOM' ? customRules : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback(`Rolling Cabinet ${cabinetNo} built with ${shelvesCount * stacksPerShelf} active stack locations.`);
        await onCabinetBuilt();
      } else {
        alert(data.error || 'Failed to build rolling cabinet');
      }
    } catch (err) {
      console.error('Error building cabinet:', err);
      alert('Network error while building rolling cabinet');
    } finally {
      setIsSaving(false);
    }
  };

  const totalStacks = shelvesCount * stacksPerShelf;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
      
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-neutral-900">Warehouse Rolling Cabinet Builder</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white font-mono">
              v1.0 Architecture
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure rolling cabinets, shelves, and stacks with automated customer & type allocation rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleBuildCabinet}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Building Cabinet...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Build / Update Cabinet {cabinetNo}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Geometry Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Cabinet Identifier
          </label>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={cabinetNo}
              onChange={e => setCabinetNo(e.target.value.toUpperCase())}
              placeholder="e.g. A3"
              className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 uppercase font-mono outline-none"
            />
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {['A3', 'A1', 'A2', 'B1', 'C9'].map(cab => (
              <button
                key={cab}
                type="button"
                onClick={() => handleSelectPresetCabinet(cab)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                  cabinetNo === cab ? 'bg-amber-400 text-neutral-950 font-bold' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                }`}
              >
                {cab}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Shelves per Cabinet
          </label>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neutral-400" />
            <input
              type="number"
              min={1}
              max={12}
              value={shelvesCount}
              onChange={e => handleShelvesCountChange(Math.max(1, Math.min(12, Number(e.target.value))))}
              className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 outline-none"
            />
          </div>
          <span className="text-[10px] text-neutral-400 block">10 shelves = 2 vertical partitions (1–5 Left, 6–10 Right)</span>
        </div>

        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            Stacks per Shelf
          </label>
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-neutral-400" />
            <input
              type="number"
              min={1}
              max={6}
              value={stacksPerShelf}
              onChange={e => setStacksPerShelf(Math.max(1, Math.min(6, Number(e.target.value))))}
              className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs font-bold text-neutral-900 outline-none"
            />
          </div>
          <span className="text-[10px] text-neutral-400 block">3 stacks/shelf = Total {totalStacks} stacks ({cabinetNo}-1-1 to {cabinetNo}-{shelvesCount}-{stacksPerShelf})</span>
        </div>

      </div>

      {/* Preset Rules Selector */}
      <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-800">Arrangement & Allocation Preset</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreset('HUGO_BOSS_STANDARD')}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                preset === 'HUGO_BOSS_STANDARD'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              Hugo Boss Standard Dual-Partition Preset
            </button>
            <button
              type="button"
              onClick={() => setPreset('CUSTOM')}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                preset === 'CUSTOM'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              Custom Configuration
            </button>
          </div>
        </div>

        {preset === 'HUGO_BOSS_STANDARD' ? (
          <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Hugo Boss Permanent Architecture Standards (Cabinet {cabinetNo})</span>
            </div>
            <p className="text-xs text-neutral-600">
              Cabinet {cabinetNo} is partitioned vertically into two halves with 3 stacks per shelf. Code format: <strong className="font-mono text-neutral-900">[{cabinetNo}]-[shelf]-[stack]</strong>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
                <span className="font-bold text-neutral-900 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-neutral-900" />
                  Left Partition (Shelves 1 to 5): BOSS Pillar
                </span>
                <p className="text-neutral-600 text-[11px]">Contemporary Luxury & Tailoring</p>
                <ul className="text-[11px] text-neutral-700 space-y-0.5 list-disc pl-4 mt-1">
                  <li>Shelf 1: Polos & T-Shirts (16 units/stack)</li>
                  <li>Shelf 2: Sweaters & Knitwear (14 units/stack)</li>
                  <li>Shelf 3: Pants & Bottoms (14 units/stack)</li>
                  <li>Shelf 4: Jackets & Outerwear (6 units/stack)</li>
                  <li>Shelf 5: Suiting & Tailoring (6 units/stack)</li>
                </ul>
              </div>
              <div className="p-3 bg-red-50/50 rounded-lg border border-red-200 space-y-1">
                <span className="font-bold text-red-950 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Right Partition (Shelves 6 to 10): HUGO Pillar
                </span>
                <p className="text-red-700 text-[11px]">Progressive Streetwear & General Archive</p>
                <ul className="text-[11px] text-red-900 space-y-0.5 list-disc pl-4 mt-1">
                  <li>Shelf 6: Graphic Tees & Polos (16 units/stack)</li>
                  <li>Shelf 7: Hoodies & Sweatshirts (12 units/stack)</li>
                  <li>Shelf 8: Denim & Street Pants (14 units/stack)</li>
                  <li>Shelf 9: Casual Jackets & Outerwear (8 units/stack)</li>
                  <li>Shelf 10: Archive & Overflow (14 units/stack)</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs font-bold text-neutral-700">Custom Shelf Configurations:</span>
            <div className="space-y-2">
              {shelfConfigs.map((cfg, idx) => (
                <div key={cfg.shelfNo} className="bg-white p-3 rounded-xl border border-neutral-200 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold font-mono text-neutral-900 w-16">
                    Shelf {cfg.shelfNo}:
                  </span>

                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Assigned Customer</label>
                    <select
                      value={cfg.buyer}
                      onChange={e => handleUpdateShelfConfig(idx, 'buyer', e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg outline-none"
                    >
                      <option value="BOSS">BOSS (Contemporary Luxury)</option>
                      <option value="HUGO">HUGO (Streetwear)</option>
                      <option value="Hugo Boss">Hugo Boss (Combined)</option>
                      <option value="Ralph Lauren">Ralph Lauren</option>
                      <option value="Puma">Puma</option>
                      <option value="Overflow / General">Overflow / General</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Garment Category</label>
                    <select
                      value={cfg.type}
                      onChange={e => handleUpdateShelfConfig(idx, 'type', e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg outline-none"
                    >
                      <option value="Polo / T-Shirt">Polo / T-Shirt (Thin)</option>
                      <option value="Jacket / Outerwear">Jacket / Outerwear (Bulky)</option>
                      <option value="Streetwear / Casual">Streetwear / Casual</option>
                      <option value="Pants / Bottoms">Pants / Bottoms</option>
                      <option value="All Garments">All Garments</option>
                    </select>
                  </div>

                  <div className="w-28">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Max Units</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={cfg.capacity}
                      onChange={e => handleUpdateShelfConfig(idx, 'capacity', Number(e.target.value))}
                      className="w-full text-xs font-bold px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg outline-none font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
