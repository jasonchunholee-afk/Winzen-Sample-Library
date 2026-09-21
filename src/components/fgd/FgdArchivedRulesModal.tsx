import React, { useState } from 'react';
import {
  X,
  Archive,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Tag,
  Globe,
  Loader2
} from 'lucide-react';
import { DbLabelingRule } from './types';

export interface FgdArchivedRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: DbLabelingRule[];
  onRecallRule: (ruleCode: string) => Promise<void>;
  onReapplyRule: (ruleCode: string) => Promise<void>;
  isRecallingCode?: string | null;
}

export const FgdArchivedRulesModal: React.FC<FgdArchivedRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  onRecallRule,
  onReapplyRule,
  isRecallingCode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'all' | 'hugo' | 'global'>('all');

  if (!isOpen) return null;

  const filteredRules = rules.filter(rule => {
    const isHugo = rule.target_field === 'buyer' ||
      /hugo|boss/i.test(rule.rule_title) ||
      /hugo|boss/i.test(rule.rule_instruction) ||
      /hugo|boss/i.test(rule.source_feedback || '');

    if (filterScope === 'hugo' && !isHugo) return false;
    if (filterScope === 'global' && isHugo) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.rule_code.toLowerCase().includes(query) ||
      rule.rule_title.toLowerCase().includes(query) ||
      rule.target_field.toLowerCase().includes(query) ||
      rule.rule_instruction.toLowerCase().includes(query) ||
      (rule.condition_trigger && rule.condition_trigger.toLowerCase().includes(query)) ||
      (rule.source_feedback && rule.source_feedback.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-neutral-200 bg-neutral-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <Archive className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900">
                  Archived Rules & Calibrated Deductions
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {rules.length} Approved & Active in DB
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Approved rules are archived and hidden from the FGD Test loop. Review directives below or recall any rule for revision.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-neutral-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search archived rules, codes, fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-800"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('hugo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterScope === 'hugo'
                  ? 'bg-purple-900 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              🏷️ Hugo Boss
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('global')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterScope === 'global'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              🌐 Global Patterns
            </button>
          </div>
        </div>

        {/* Scrollable Rules List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
          {filteredRules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 p-8 space-y-2">
              <Archive className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="text-sm font-bold text-neutral-700">No archived rules match the current filter</p>
              <p className="text-xs text-neutral-500">
                {searchQuery ? `No results for "${searchQuery}". Clear query to see all rules.` : 'Approved rules will automatically appear here once approved in FGD Test Mode.'}
              </p>
            </div>
          ) : (
            filteredRules.map((rule) => {
              const isHugo = rule.target_field === 'buyer' ||
                /hugo|boss/i.test(rule.rule_title) ||
                /hugo|boss/i.test(rule.rule_instruction) ||
                /hugo|boss/i.test(rule.source_feedback || '');
              const isOperating = isRecallingCode === rule.rule_code;

              return (
                <div
                  key={rule.rule_code || rule.id}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3.5 hover:border-neutral-300 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        rule.rule_type === 'negative'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {rule.rule_code} • {rule.rule_type.toUpperCase()}
                      </span>

                      {isHugo ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1 shadow-2xs">
                          <Tag className="w-3 h-3 text-purple-700" />
                          <span>Customer-Specific [HUGO BOSS]</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1 shadow-2xs">
                          <Globe className="w-3 h-3 text-blue-700" />
                          <span>Global Pattern Rule</span>
                        </span>
                      )}

                      <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        Target: [{rule.target_field}]
                      </span>
                      <span className="text-sm font-bold text-neutral-900">
                        {rule.rule_title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {rule.is_active ? (
                        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Active in DB</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Recalled / Pending Review</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Directive & Trigger Box */}
                  <div className="space-y-1.5 text-xs bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/70">
                    <p className="text-neutral-800">
                      <strong className="text-neutral-900 font-semibold">Directive:</strong> {rule.rule_instruction}
                    </p>
                    <p className="text-neutral-600">
                      <strong className="text-neutral-700 font-semibold">Trigger:</strong> {rule.condition_trigger}
                    </p>
                    {rule.example_positive && (
                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <span className="text-emerald-700 font-semibold">
                          ✓ Desired: {rule.example_positive}
                        </span>
                        {rule.example_negative && (
                          <span className="text-red-600 font-semibold">
                            ✗ Flawed: {rule.example_negative}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Source Feedback / Merchandiser Commentary */}
                  {rule.source_feedback && (
                    <div className="text-[11px] text-neutral-500 bg-neutral-100/70 px-3 py-2 rounded-lg border border-neutral-200/50">
                      <span className="font-semibold text-neutral-700">Source / Origin:</span> {rule.source_feedback}
                    </div>
                  )}

                  {/* Footer Actions: Recall / Re-open for Review */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-xs text-neutral-400">
                    <span>
                      {rule.updated_at ? `Approved / Updated: ${new Date(rule.updated_at).toLocaleString()}` : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      {rule.is_active ? (
                        <button
                          type="button"
                          onClick={() => onRecallRule(rule.rule_code)}
                          disabled={isOperating}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Recall rule from archive back to pending review in FGD Test Mode"
                        >
                          {isOperating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
                          )}
                          <span>Recall for Re-review</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReapplyRule(rule.rule_code)}
                          disabled={isOperating}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isOperating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>Re-archive to DB</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Persisted durably in PostgreSQL table <code>labeling_rules</code>.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close Review
          </button>
        </div>
      </div>
    </div>
  );
};
