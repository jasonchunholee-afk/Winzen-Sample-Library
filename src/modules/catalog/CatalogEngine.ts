/**
 * CatalogEngine.ts
 * 
 * Domain Micro-Module: modules/catalog/
 * Encapsulates the Official Archive & Query Engine:
 * - Searchable, multi-faceted filtering across all garments
 * - Export generators (PDF, Excel, and JSON spec sheets)
 * - Factory seed hydration & catalog synchronization
 */

import { EcosystemCoordinator } from '../../core/coordinator/EcosystemCoordinator';

export interface CatalogFilterOptions {
  query?: string;
  buyer?: string;
  season?: string;
  category?: string;
  status?: string;
  warehouseLocation?: string;
}

export class CatalogEngine {
  private static instance: CatalogEngine;
  private coordinator: EcosystemCoordinator;

  private constructor() {
    this.coordinator = EcosystemCoordinator.getInstance();
  }

  public static getInstance(): CatalogEngine {
    if (!CatalogEngine.instance) {
      CatalogEngine.instance = new CatalogEngine();
    }
    return CatalogEngine.instance;
  }

  /**
   * Filter catalog garments according to structured criteria
   */
  public filterGarments(garments: any[], filters: CatalogFilterOptions): any[] {
    return garments.filter(g => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const matchesQuery = 
          (g.id || '').toLowerCase().includes(q) ||
          (g.styleNo || '').toLowerCase().includes(q) ||
          (g.buyer || '').toLowerCase().includes(q) ||
          (g.fabricComposition || '').toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (filters.buyer && g.buyer !== filters.buyer) return false;
      if (filters.season && g.season !== filters.season) return false;
      if (filters.category && g.category !== filters.category) return false;
      if (filters.status && g.status !== filters.status) return false;

      return true;
    });
  }

  /**
   * Trigger factory seed hydration from server
   */
  public async hydrateFactorySeeds(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const res = await fetch('/api/developer/hydrate-seeds', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { success: true, count: data.count || 0 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate Spec Sheet Export
   */
  public exportSpecSheet(garmentId: string, format: 'json' | 'csv' = 'json'): void {
    const endpoint = `/api/export-spec?garmentId=${encodeURIComponent(garmentId)}&format=${format}`;
    window.open(endpoint, '_blank');
  }
}
