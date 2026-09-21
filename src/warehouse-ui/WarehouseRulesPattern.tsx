import React, { useState } from 'react';
import { BrainCircuit, Sparkles, RefreshCw, Box, Tag } from 'lucide-react';

interface WarehouseRule {
  rule_code: string;
  target_location: string;
  condition_trigger: string;
  positive_examples: string[];
  negative_examples: string[];
}

export function WarehouseRulesPattern() {
  const [digesting, setDigesting] = useState(false);
  const [rules, setRules] = useState<WarehouseRule[]>([]);
  const [error, setError] = useState('');

  const handleDigest = async () => {
    setDigesting(true);
    setError('');
    try {
      const res = await fetch('/api/warehouse/rules/digest', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to digest rules');
      }
      setRules(data.rules || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setDigesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-500" />
            AI Rules Digestion
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            Digest plain-language feedback from merchandisers into structured placement rules.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDigest}
          disabled={digesting}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          {digesting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Digesting Logic Logs...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Digest Logic Logs to Rules</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      {rules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule, idx) => (
            <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                      {rule.rule_code}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-neutral-800">{rule.condition_trigger}</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-0.5">Target Location</span>
                  <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
                    {rule.target_location}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-800 uppercase text-[10px] tracking-wider block">Positive Matches</span>
                  <ul className="space-y-1">
                    {rule.positive_examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-emerald-700">
                        <Tag className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5 p-2 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="font-bold text-rose-800 uppercase text-[10px] tracking-wider block">Negative Examples</span>
                  <ul className="space-y-1">
                    {rule.negative_examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-rose-700">
                        <Box className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <BrainCircuit className="w-12 h-12 text-neutral-300 mb-4" />
          <h3 className="text-lg font-bold text-neutral-800">No Structured Rules Yet</h3>
          <p className="text-sm text-neutral-500 max-w-sm mt-2">
            Click "Digest Logic Logs to Rules" to have the AI synthesize merchandiser plain-language logs into structured placement rules.
          </p>
        </div>
      )}
    </div>
  );
}
