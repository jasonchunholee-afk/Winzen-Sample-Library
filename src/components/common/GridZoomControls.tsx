import React from 'react';
import { Minus, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { useGridDisplay } from '../../context/GridDisplayContext';

interface GridZoomControlsProps {
  className?: string;
  showYearSort?: boolean;
}

export function GridZoomControls({ className = '', showYearSort = true }: GridZoomControlsProps) {
  const { gridCols, setGridCols, yearSortOrder, toggleYearSortOrder } = useGridDisplay();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Year Sort Toggle Button */}
      {showYearSort && (
        <button
          type="button"
          onClick={toggleYearSortOrder}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:text-neutral-900 transition-colors shadow-2xs cursor-pointer select-none"
          title={`Sort garments by year: Currently ${yearSortOrder === 'desc' ? 'Descending (Newest first)' : 'Ascending (Oldest first)'}. Click to toggle.`}
        >
          {yearSortOrder === 'desc' ? (
            <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
          )}
          <span>Year: {yearSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
        </button>
      )}

      {/* Grid Zoom Controls */}
      <div 
        className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1 shrink-0 shadow-2xs" 
        title="Adjust grid columns across screen"
      >
        {/* "-" button: Decreases columns number (e.g. 4 -> 3) */}
        <button 
          type="button"
          onClick={() => setGridCols(prev => Math.max(2, prev - 1))}
          disabled={gridCols <= 2}
          className={`p-1.5 rounded transition-colors flex items-center justify-center ${
            gridCols <= 2 
              ? 'text-neutral-300 cursor-not-allowed' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer'
          }`}
          title="Fewer columns across (-)"
          aria-label="Fewer columns across"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Display value: e.g. "4 across" */}
        <span className="text-xs font-semibold px-1 text-neutral-800 min-w-16 text-center select-none">
          {gridCols} across
        </span>

        {/* "+" button: Increases columns number (e.g. 4 -> 5) */}
        <button 
          type="button"
          onClick={() => setGridCols(prev => Math.min(8, prev + 1))}
          disabled={gridCols >= 8}
          className={`p-1.5 rounded transition-colors flex items-center justify-center ${
            gridCols >= 8 
              ? 'text-neutral-300 cursor-not-allowed' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer'
          }`}
          title="More columns across (+)"
          aria-label="More columns across"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
