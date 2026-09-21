import React from 'react';
import { Layers, Check, Copy } from 'lucide-react';
import { GarmentTestReport } from './types';

interface FgdArchiveSelectorProps {
  reports: GarmentTestReport[];
  selectedReportIndex: number;
  setSelectedReportIndex: (index: number) => void;
  onRefreshArchive: () => void;
  copiedReport: boolean;
  onCopyReport: () => void;
}

/**
 * FgdArchiveSelector - Revisit & Navigate Historical Evaluation Runs
 */
export function FgdArchiveSelector({
  reports,
  selectedReportIndex,
  setSelectedReportIndex,
  onRefreshArchive,
  copiedReport,
  onCopyReport
}: FgdArchiveSelectorProps) {
  if (reports.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Archive Selector & Revisit Panel */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900">
                Archived Evaluation Reports
              </span>
              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-[11px] font-bold">
                {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} Archived
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Select any historical evaluation run to revisit, review discrepancy analyses, or refine rules.
            </p>
          </div>
        </div>

        {/* Dropdown Selector for Archived Reports */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="archive-select" className="text-xs font-bold text-neutral-600 whitespace-nowrap">
              (Re)visit Report:
            </label>
            <select
              id="archive-select"
              value={selectedReportIndex}
              onChange={(e) => setSelectedReportIndex(Number(e.target.value))}
              className="text-xs font-semibold bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-neutral-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              {reports.map((rep, idx) => {
                const dateStr = rep.tested_at ? new Date(rep.tested_at).toLocaleDateString() : '';
                const timeStr = rep.tested_at ? new Date(rep.tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <option key={(rep as any).id || idx} value={idx}>
                    {rep.garment_id} • {dateStr} {timeStr} • Score: {rep.final_score}/10 ({rep.final_verdict})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={onRefreshArchive}
            className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Reload archived reports from server"
          >
            Refresh Archive
          </button>

          <button
            type="button"
            onClick={onCopyReport}
            className="px-3.5 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-xl text-xs font-semibold text-neutral-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>Copy Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Chip Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {reports.map((rep, idx) => (
          <button
            key={(rep as any).id || `${rep.garment_id}_${idx}`}
            onClick={() => setSelectedReportIndex(idx)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              selectedReportIndex === idx
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <span>{rep.garment_id}</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded ${
              rep.final_score >= 9.0 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : rep.final_score >= 8.0 
                  ? 'bg-blue-500/20 text-blue-300' 
                  : 'bg-amber-500/20 text-amber-300'
            }`}>
              {rep.final_score}/10
            </span>
            {rep.tested_at && (
              <span className="text-[10px] opacity-60">
                {new Date(rep.tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
