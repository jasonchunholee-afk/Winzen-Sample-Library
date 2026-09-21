import React from 'react';
import { Play, Square, RotateCcw, Archive, Trash2, Loader2 } from 'lucide-react';
import { LibraryGarment } from './types';

export interface FgdControlHeaderProps {
  libraryGarments: LibraryGarment[];
  approvedGarments?: LibraryGarment[];
  underReviewGarments: LibraryGarment[];
  selectedGarmentId: string;
  setSelectedGarmentId: (id: string) => void;
  maxLoops: number;
  setMaxLoops: (loops: number) => void;
  running: boolean;
  handleStartSuite: () => void;
  handleStopSuite: () => void;
  handleRerunUnderReview: () => void;
  archivedRulesCount?: number;
  onOpenArchivedRules?: () => void;
  pendingRulesCount?: number;
  onWipePendingRules?: () => void;
  isWipingRules?: boolean;
}

export const FgdControlHeader: React.FC<FgdControlHeaderProps> = React.memo(({
  libraryGarments,
  approvedGarments,
  underReviewGarments,
  selectedGarmentId,
  setSelectedGarmentId,
  maxLoops,
  setMaxLoops,
  running,
  handleStartSuite,
  handleStopSuite,
  handleRerunUnderReview,
  archivedRulesCount,
  onOpenArchivedRules,
  pendingRulesCount = 0,
  onWipePendingRules,
  isWipingRules = false
}) => {
  const approvedCount = approvedGarments ? approvedGarments.length : libraryGarments.filter(g => g.status === 'Approved').length;

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            Autonomous Background Worker Engine
          </span>
          <h2 className="text-xl font-bold text-neutral-900">
            Full Garment Description (FGD) Test Mode
          </h2>
        </div>
        <p className="text-sm text-neutral-500 max-w-3xl">
          Runs as a dedicated server background task. You can switch to the Library tab, run search queries, or inspect photos while this analytical suite continues chunked OCR, visual evaluation, and rule calibration uninterrupted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Garment Selector */}
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
          <span className="text-xs font-semibold text-neutral-600">Garment:</span>
          <select
            value={selectedGarmentId}
            onChange={(e) => setSelectedGarmentId(e.target.value)}
            disabled={running}
            className="bg-transparent text-sm font-bold text-neutral-900 focus:outline-none cursor-pointer"
          >
            <option value="all">Approved Garments Only ({approvedCount})</option>
            {underReviewGarments.length > 0 && (
              <option value="under_review">⚠️ Garments Under Review ({underReviewGarments.length})</option>
            )}
            {libraryGarments.map(g => (
              <option key={g.id} value={g.id}>{g.id} ({g.buyer || 'Sample'}){g.status && g.status !== 'Approved' ? ' [Review]' : ''}</option>
            ))}
          </select>
        </div>

        {/* Loops Selector */}
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
          <span className="text-xs font-semibold text-neutral-600">Max Loops:</span>
          <select
            value={maxLoops}
            onChange={(e) => setMaxLoops(Number(e.target.value))}
            disabled={running}
            className="bg-transparent text-sm font-bold text-neutral-900 focus:outline-none cursor-pointer"
          >
            <option value={1}>1 Loop (Fast)</option>
            <option value={2}>2 Loops (Auto-Calibrate)</option>
          </select>
        </div>

        {/* Re-run FGD for garments under review Button */}
        <button
          type="button"
          onClick={handleRerunUnderReview}
          disabled={running || underReviewGarments.length === 0}
          title={underReviewGarments.length === 0 ? "No garments are currently under review" : `Re-run FGD for ${underReviewGarments.length} garment(s) currently awaiting review with all approved rules`}
          className="px-4.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all border border-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RotateCcw className={`w-4 h-4 text-neutral-900 ${running ? 'animate-spin' : ''}`} />
          <span>Re-run FGD for garments under review</span>
          <span className="px-2 py-0.5 text-xs font-black rounded-full bg-neutral-900 text-amber-300">
            {underReviewGarments.length}
          </span>
        </button>

        {/* Wipe Last Round Pending Rules Option */}
        {onWipePendingRules && (
          <button
            type="button"
            onClick={onWipePendingRules}
            disabled={running || isWipingRules}
            title={
              pendingRulesCount === 0
                ? "Open Wipe Pending Rules manager (0 unapproved candidate rules currently detected)"
                : `Wipe out ${pendingRulesCount} unapproved pending rule(s) generated after the last FGD evaluation round`
            }
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 text-sm font-bold rounded-xl flex items-center gap-2 shadow-2xs transition-all border border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isWipingRules ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
            ) : (
              <Trash2 className="w-4 h-4 text-rose-600" />
            )}
            <span>Wipe Pending Rules</span>
            {pendingRulesCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                {pendingRulesCount}
              </span>
            )}
          </button>
        )}

        {/* View Archived Rules Button */}
        {archivedRulesCount !== undefined && onOpenArchivedRules && (
          <button
            type="button"
            onClick={onOpenArchivedRules}
            className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all border border-neutral-300 cursor-pointer"
            title="Inspect approved rules archived to database"
          >
            <Archive className="w-4 h-4 text-emerald-700" />
            <span>Archived Rules</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              {archivedRulesCount}
            </span>
          </button>
        )}

        {/* Execution Button */}
        {running ? (
          <button
            onClick={handleStopSuite}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current text-white" />
            <span>Stop Test Suite</span>
          </button>
        ) : (
          <button
            onClick={handleStartSuite}
            disabled={libraryGarments.length === 0}
            className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current text-emerald-400" />
            <span>Start Test Suite</span>
          </button>
        )}
      </div>
    </div>
  );
});

FgdControlHeader.displayName = 'FgdControlHeader';
