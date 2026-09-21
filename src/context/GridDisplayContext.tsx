import React, { createContext, useContext, useState, useEffect } from 'react';

interface GridDisplayContextType {
  gridCols: number;
  setGridCols: (cols: number | ((prev: number) => number)) => void;
  yearSortOrder: 'desc' | 'asc';
  setYearSortOrder: (order: 'desc' | 'asc' | ((prev: 'desc' | 'asc') => 'desc' | 'asc')) => void;
  toggleYearSortOrder: () => void;
}

const GridDisplayContext = createContext<GridDisplayContextType>({
  gridCols: 4,
  setGridCols: () => {},
  yearSortOrder: 'desc',
  setYearSortOrder: () => {},
  toggleYearSortOrder: () => {}
});

const STORAGE_GRID_COLS_KEY = 'winzen_grid_cols';
const STORAGE_SORT_ORDER_KEY = 'winzen_year_sort_order';

export function GridDisplayProvider({ children }: { children: React.ReactNode }) {
  // 1. Initial dimension-aware grid column calculation
  const [gridCols, setGridColsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GRID_COLS_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 2 && parsed <= 8) {
          return parsed;
        }
      }
    } catch {
      // ignore localStorage errors in sandboxed iframes
    }

    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w >= 1920) return 5;
      if (w >= 1536) return 4;
      if (w >= 1024) return 3;
      if (w >= 640) return 2;
    }
    return 4;
  });

  // 2. Year sort order (descending by default for latest years first e.g. 22S -> 21S -> 20S, or toggleable to asc)
  const [yearSortOrder, setYearSortOrderState] = useState<'desc' | 'asc'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SORT_ORDER_KEY);
      if (saved === 'asc' || saved === 'desc') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'desc';
  });

  const setGridCols = (colsOrUpdater: number | ((prev: number) => number)) => {
    setGridColsState(prev => {
      const next = typeof colsOrUpdater === 'function' ? colsOrUpdater(prev) : colsOrUpdater;
      const clamped = Math.max(2, Math.min(8, next));
      try {
        localStorage.setItem(STORAGE_GRID_COLS_KEY, clamped.toString());
      } catch {
        // ignore
      }
      return clamped;
    });
  };

  const setYearSortOrder = (orderOrUpdater: 'desc' | 'asc' | ((prev: 'desc' | 'asc') => 'desc' | 'asc')) => {
    setYearSortOrderState(prev => {
      const next = typeof orderOrUpdater === 'function' ? orderOrUpdater(prev) : orderOrUpdater;
      try {
        localStorage.setItem(STORAGE_SORT_ORDER_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleYearSortOrder = () => {
    setYearSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  return (
    <GridDisplayContext.Provider
      value={{
        gridCols,
        setGridCols,
        yearSortOrder,
        setYearSortOrder,
        toggleYearSortOrder
      }}
    >
      {children}
    </GridDisplayContext.Provider>
  );
}

export function useGridDisplay() {
  return useContext(GridDisplayContext);
}
