import React from 'react';
import { ShieldCheck, RotateCcw, CheckCircle } from 'lucide-react';
import { GarmentTestReport } from './types';

interface FgdScorecardHeroProps {
  currentReport: GarmentTestReport;
  onRequestRevision?: (garmentId: string) => void;
  isRevising?: boolean;
}

/**
 * FgdScorecardHero - Displays Sandbox Isolation Assurance & Evaluation Scorecard
 */
export function FgdScorecardHero({ 
  currentReport,
  onRequestRevision,
  isRevising
}: FgdScorecardHeroProps) {
  const lastLoop = currentReport.loops[currentReport.loops.length - 1];
  const isApproved = currentReport.status === 'Approved';

  return (
    <div className="space-y-6">
      {/* Safety & Non-Destructive Sandbox Assurance Banner */}
      <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
              Sandbox Evaluation • 0 Unapproved Changes Applied
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              Evaluated on {new Date(currentReport.tested_at).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            <strong>Your catalog is 100% untouched.</strong> No garment records, baseline specs, fabric weights, or database descriptions have been altered or accepted. All discrepancy evaluations and calibrated rule proposals below remain purely advisory until you explicitly approve and click &ldquo;Apply to Rules DB&rdquo;.
          </p>
        </div>
      </div>

      {/* Scorecard Hero */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="border-r border-neutral-100 pr-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Garment Tested</div>
              {isApproved && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Approved
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1">{currentReport.garment_id}</div>
            <div className="text-xs text-neutral-500 mt-1">
              {currentReport.images_processed.length} image inputs: {currentReport.images_processed.join(', ')}
            </div>
          </div>

          {/* Revision button for approved garments */}
          {onRequestRevision && (
            <div className="mt-4 pt-3 border-t border-neutral-100">
              {isApproved ? (
                <button
                  type="button"
                  onClick={() => onRequestRevision(currentReport.garment_id)}
                  disabled={isRevising}
                  className="w-full px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Request revision for this approved garment (resets status to Revision Requested)"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${isRevising ? 'animate-spin' : ''}`} />
                  <span>{isRevising ? 'Requesting Revision...' : 'Request Revision'}</span>
                </button>
              ) : (
                <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Status: {currentReport.status || 'Under Review'}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Self-Evaluation Score</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-neutral-900">{currentReport.final_score}</span>
            <span className="text-neutral-400 font-bold text-sm">/ 10.0</span>
          </div>
          <div className={`text-xs font-bold mt-1 ${
            currentReport.final_score >= 9.0 ? 'text-emerald-600' : 'text-blue-600'
          }`}>
            {currentReport.final_verdict}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Score Breakdown</div>
          <div className="space-y-1 mt-1.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Label Accuracy:</span>
              <span className="font-bold text-neutral-900">{lastLoop?.score_breakdown?.label_accuracy ?? 0} / 4.0</span>
            </div>
            <div className="flex justify-between">
              <span>Description Fidelity:</span>
              <span className="font-bold text-neutral-900">{lastLoop?.score_breakdown?.description_fidelity ?? 0} / 4.0</span>
            </div>
            <div className="flex justify-between">
              <span>Hashtag Coverage:</span>
              <span className="font-bold text-neutral-900">{lastLoop?.score_breakdown?.hashtag_coverage ?? 0} / 2.0</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Loops Executed</div>
          <div className="text-2xl font-black text-neutral-900 mt-1">{currentReport.loops.length} {currentReport.loops.length === 1 ? 'Loop' : 'Loops'}</div>
          <div className="text-xs text-neutral-500 mt-1">
            {currentReport.loops.length > 1 
              ? `Calibrated: ${currentReport.loops[0].score}/10 -> ${currentReport.loops[1].score}/10 (+${(currentReport.loops[1].score - currentReport.loops[0].score).toFixed(1)})` 
              : 'High fidelity achieved on initial pass'}
          </div>
        </div>
      </div>
    </div>
  );
}
