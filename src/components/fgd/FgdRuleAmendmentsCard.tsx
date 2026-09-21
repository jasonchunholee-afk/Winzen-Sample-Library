import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Bot,
  Brain,
  Check,
  ShieldCheck,
  MessageSquare,
  Loader2,
  CheckCircle,
  RotateCcw,
  Send
} from 'lucide-react';
import { RuleAmendment } from './types';

export interface FgdRuleAmendmentsCardProps {
  rule: RuleAmendment;
  edit: Partial<RuleAmendment>;
  isApplied: boolean;
  isApproving: boolean;
  outcomeMsg?: string;
  thread: {
    isOpen: boolean;
    feedback: string;
    isThinking: boolean;
    messages: Array<{
      sender: 'user' | 'ai';
      text: string;
      recommendation?: string;
    }>;
  };
  isHugoBoss: boolean;
  toggleRuleThread: (ruleCode: string) => void;
  handleApproveAiDeduction: (rule: RuleAmendment) => void;
  handleRerunUnderReview: () => void;
  running: boolean;
  underReviewGarmentsCount: number;
  updateRuleFeedback: (ruleCode: string, text: string) => void;
  handleSendRecorrection: (rule: RuleAmendment) => void;
}

export const FgdRuleAmendmentsCard: React.FC<FgdRuleAmendmentsCardProps> = React.memo(({
  rule,
  edit,
  isApplied,
  isApproving,
  outcomeMsg,
  thread,
  isHugoBoss,
  toggleRuleThread,
  handleApproveAiDeduction,
  handleRerunUnderReview,
  running,
  underReviewGarmentsCount,
  updateRuleFeedback,
  handleSendRecorrection
}) => {
  return (
    <div className="border border-neutral-200 bg-white p-5 rounded-2xl space-y-4 shadow-xs transition-all">
      {/* Rule Header & Scope Classification */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
            rule.rule_type === 'negative' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}>
            {rule.rule_code} • {rule.rule_type.toUpperCase()}
          </span>

          {/* Scope Badge: Customer-Specific vs Global Pattern */}
          {isHugoBoss ? (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1 shadow-2xs">
              🏷️ Customer-Specific Rule [HUGO BOSS]
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1 shadow-2xs">
              🌐 Pattern Rule [Global / Multi-Garment]
            </span>
          )}

          <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
            Target: [{edit.target_field || rule.target_field}]
          </span>
          <span className="text-sm font-bold text-neutral-900">
            {edit.rule_title || rule.rule_title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isApplied ? (
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active in Rules DB</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Ready for Merchandiser Approval</span>
            </span>
          )}
        </div>
      </div>

      {/* Rule Directive & Trigger Display */}
      <div className="space-y-1.5 text-xs bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/70">
        <p className="text-neutral-800">
          <strong className="text-neutral-900 font-semibold">Directive:</strong> {edit.rule_instruction || rule.rule_instruction}
        </p>
        <p className="text-neutral-600">
          <strong className="text-neutral-700 font-semibold">Trigger:</strong> {edit.condition_trigger || rule.condition_trigger}
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

      {/* Gemini-Style AI Pattern Advisory & Impact Card */}
      <div className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 border border-indigo-200/90 rounded-2xl p-4.5 space-y-4 shadow-2xs">
        {/* Advisory Header */}
        <div className="flex items-center justify-between border-b border-indigo-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                AI Pattern Deduction & Recommendation
              </h5>
              <span className="text-[11px] text-indigo-700 font-medium">
                {isHugoBoss ? 'Permanent Brand Architecture Standard' : 'Discrepancy Synthesis & Calibration'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-neutral-500 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
            Thread Synthesis
          </span>
        </div>

        {/* AI Deduction Text */}
        <div className="bg-white/80 border border-indigo-100/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
            <Brain className="w-4 h-4 text-indigo-600" />
            <span>AI Deduction:</span>
          </div>
          <p className="text-xs text-neutral-800 leading-relaxed font-sans">
            {isHugoBoss ? (
              <>
                <strong>Hugo Boss</strong> restructured into two distinct permanent brand pillars: <strong>'HUGO'</strong> (Gen Z / progressive streetwear / red accents / standalone retail stores) and <strong>'BOSS'</strong> (contemporary luxury / tailoring / camel-black-white palette, including lines BOSS Black, BOSS Orange, BOSS Green). This corporate restructuring is permanent brand architecture, <strong>NOT</strong> a temporal line.
              </>
            ) : (
              <>
                Extracted label indicates a systematic difference from raw baseline. We have formulated an extraction rule to normalize future OCR extraction for <strong>[{edit.target_field || rule.target_field}]</strong> without manual intervention.
              </>
            )}
          </p>
        </div>

        {/* Outcome Explanation: What will happen if approved */}
        <div className="bg-indigo-950/5 border border-indigo-200/50 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="font-bold text-indigo-950 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Outcome & Impact of Approving:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-neutral-700">
            <div className="flex items-start gap-1.5 bg-white/70 p-2 rounded-lg border border-indigo-100">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-neutral-900">1. Natural Language Digested:</span>
                <p className="text-neutral-600">Your feedback is harmonized into formal taxonomy extraction directives.</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 bg-white/70 p-2 rounded-lg border border-indigo-100">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-neutral-900">2. Customer-Specific Anchoring:</span>
                <p className="text-neutral-600">Locked to {isHugoBoss ? 'HUGO BOSS' : 'the target customer'} so it never collides with generic or temporal rules.</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 bg-white/70 p-2 rounded-lg border border-indigo-100">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-neutral-900">3. Durable Pattern Memory:</span>
                <p className="text-neutral-600">Archived to persistent observation memory to train cross-garment pattern deductions.</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 bg-white/70 p-2 rounded-lg border border-indigo-100">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-neutral-900">4. Live Catalog Enforcement:</span>
                <p className="text-neutral-600">Saved to PostgreSQL database and actively enforced across all future extraction runs.</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendation Box */}
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>AI Recommendation:</strong> Approve & Apply. All 4 operations execute concurrently in one step without conflict.
            </span>
          </div>
        </div>

        {/* Primary Unified Actions */}
        <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
          <button
            type="button"
            onClick={() => toggleRuleThread(rule.rule_code)}
            className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>{thread.isOpen ? 'Close Discussion' : '💬 Recorrect / Discuss with AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleApproveAiDeduction(rule)}
            disabled={isApplied || isApproving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
              isApplied 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-default' 
                : isApproving
                ? 'bg-neutral-400 text-white cursor-wait'
                : 'bg-neutral-900 hover:bg-black text-white cursor-pointer active:scale-95'
            }`}
          >
            {isApproving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Executing Unified Approval...</span>
              </>
            ) : isApplied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Deduction Approved & Active in DB</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>✓ Approve & Apply AI Deduction</span>
              </>
            )}
          </button>
        </div>

        {/* Success Banner if applied */}
        {outcomeMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="leading-relaxed">{outcomeMsg}</span>
            </div>
            <button
              type="button"
              onClick={handleRerunUnderReview}
              disabled={running || underReviewGarmentsCount === 0}
              className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
              <span>Re-run Review ({underReviewGarmentsCount})</span>
            </button>
          </div>
        )}

        {/* Interactive Recorrection / Discussion Thread (Gemini Style) */}
        {thread.isOpen && (
          <div className="border-t border-indigo-200/70 pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-indigo-950 font-bold">
              <span className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-600" />
                Consultation & Pattern Recorrection Thread
              </span>
              <span className="text-[11px] font-normal text-neutral-500">
                Give plain English instructions to adjust the deduction
              </span>
            </div>

            {/* Conversation Messages */}
            {thread.messages.length > 0 && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {thread.messages.map((msg, mIdx) => (
                  <div 
                    key={mIdx} 
                    className={`p-3 rounded-xl text-xs ${
                      msg.sender === 'user' 
                        ? 'bg-neutral-100 text-neutral-900 ml-6 border border-neutral-200' 
                        : 'bg-indigo-50/80 text-indigo-950 mr-6 border border-indigo-200'
                    }`}
                  >
                    <div className="font-bold mb-1 flex items-center gap-1 text-[11px] text-neutral-500">
                      {msg.sender === 'user' ? 'Merchandiser (You):' : 'AI Assistant:'}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    {msg.recommendation && (
                      <div className="mt-2 pt-2 border-t border-indigo-200/60 font-semibold text-emerald-800 text-[11px]">
                        {msg.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {thread.isThinking && (
              <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50/50 p-3 rounded-xl">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>AI is analyzing your feedback and updating the pattern deduction...</span>
              </div>
            )}

            {/* Input Box */}
            <div className="space-y-2">
              <textarea
                rows={2}
                value={thread.feedback}
                onChange={(e) => updateRuleFeedback(rule.rule_code, e.target.value)}
                placeholder="e.g., 'Make sure this customer rule notes that BOSS Orange is casual wear' or 'For ABC brand, check whether this label indicates women's silhouette rather than men's...'"
                className="w-full text-xs p-3 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-neutral-900 shadow-2xs placeholder:text-neutral-400"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSendRecorrection(rule)}
                  disabled={!thread.feedback.trim() || thread.isThinking}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Send className="w-3 h-3 text-white" />
                  <span>Send Guidance to AI</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FgdRuleAmendmentsCard.displayName = 'FgdRuleAmendmentsCard';
