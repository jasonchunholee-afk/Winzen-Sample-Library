import React from 'react';
import { Sparkles, BookmarkPlus, Loader2, CheckCircle2, Check, Send } from 'lucide-react';
import { RuleAmendment } from './types';

interface FgdMerchandiserFeedbackProps {
  generalCommentary: string;
  setGeneralCommentary: (val: string) => void;
  isDigestingGeneral: boolean;
  handleDigestGeneralCommentary: () => void;
  digestedFeedbackSuccess: string | null;
  digestedRules: RuleAmendment[];
  setDigestedRules: React.Dispatch<React.SetStateAction<RuleAmendment[]>>;
  appliedRules: Set<string>;
  handleApplyRule: (rule: RuleAmendment) => void;
}

/**
 * FgdMerchandiserFeedback - Natural Language Guidance with Automated AI Translation
 * 
 * Merchandisers provide plain language observations; the system digests them
 * into structured labeling rules ready for approval.
 */
export function FgdMerchandiserFeedback({
  generalCommentary,
  setGeneralCommentary,
  isDigestingGeneral,
  handleDigestGeneralCommentary,
  digestedFeedbackSuccess,
  digestedRules,
  setDigestedRules,
  appliedRules,
  handleApplyRule
}: FgdMerchandiserFeedbackProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-50/80 via-white to-neutral-50 border border-indigo-200/90 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-indigo-950 uppercase tracking-wide flex items-center gap-2">
              <span>Merchandiser Feedback & Guidance</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold lowercase tracking-normal">
                ai auto-digest
              </span>
            </h3>
            <p className="text-xs text-neutral-600">
              Write your observations in plain English. The AI automatically translates them into catalog rules for your approval.
            </p>
          </div>
        </div>

        {/* Preset Chips for Merchandiser */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setGeneralCommentary("Hugo Boss restructured permanently into two distinct brand pillars: 'HUGO' and 'BOSS'. They operate separate standalone retail stores, differing design languages, and distinct target demographics. This is a permanent brand architecture, NOT a temporal line.")}
            className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold rounded-lg transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            title="Load Hugo Boss Permanent Architecture Note"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Hugo Boss Permanent Architecture</span>
          </button>
          <button
            type="button"
            onClick={() => setGeneralCommentary("Always prioritize fabric weight and yarn count specified on the sample card specification over physical care label printings.")}
            className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-[11px] font-medium rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            Fabric Weight Priority
          </button>
        </div>
      </div>

      {/* Commentary Input */}
      <div className="space-y-2">
        <textarea
          rows={3}
          value={generalCommentary}
          onChange={(e) => setGeneralCommentary(e.target.value)}
          placeholder="Type your feedback or domain instructions here in plain English (e.g., 'Hugo Boss restructured into two brands HUGO and BOSS with separate stores and aesthetics. It is a permanent brand architecture, not a temporal line.' or 'Ensure single jersey is translated with traditional Chinese')..."
          className="w-full text-xs p-3.5 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed text-neutral-900 placeholder:text-neutral-400 shadow-2xs"
        />

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <span className="text-[11px] text-neutral-500">
            No engineering parameters or condition triggers required — the system extracts the directives automatically.
          </span>

          <button
            type="button"
            onClick={handleDigestGeneralCommentary}
            disabled={isDigestingGeneral || !generalCommentary.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            {isDigestingGeneral ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Digesting & Translating with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>✨ Digest & Translate Commentary into Rules</span>
              </>
            )}
          </button>
        </div>
      </div>

      {digestedFeedbackSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{digestedFeedbackSuccess}</span>
        </div>
      )}

      {/* Digested Rules Ready for Approval */}
      {digestedRules.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-indigo-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              AI-Translated Rules Ready for Approval ({digestedRules.length})
            </span>
            <button
              type="button"
              onClick={() => setDigestedRules([])}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              Clear List
            </button>
          </div>

          <div className="space-y-3">
            {digestedRules.map((dRule, dIdx) => {
              const isApplied = appliedRules.has(dRule.rule_code);
              return (
                <div key={dIdx} className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {dRule.rule_code} • {dRule.rule_type.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        Target: [{dRule.target_field}]
                      </span>
                      <span className="text-xs font-bold text-neutral-900">
                        {dRule.rule_title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyRule(dRule)}
                      disabled={isApplied}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isApplied
                          ? 'bg-emerald-100 text-emerald-800 cursor-default'
                          : 'bg-neutral-900 hover:bg-black text-white shadow-xs cursor-pointer active:scale-95'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Rule Active in DB</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approve & Apply to Rules DB</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-200/70 space-y-1">
                    <p><strong className="text-neutral-900">Directive:</strong> {dRule.rule_instruction}</p>
                    <p className="text-neutral-500"><strong className="text-neutral-700">Trigger:</strong> {dRule.condition_trigger}</p>
                    {dRule.example_positive && (
                      <p className="text-emerald-700 font-medium">✓ Desired: {dRule.example_positive}</p>
                    )}
                    {dRule.user_comment && (
                      <p className="text-neutral-500 italic text-[11px]">Comment: "{dRule.user_comment}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
