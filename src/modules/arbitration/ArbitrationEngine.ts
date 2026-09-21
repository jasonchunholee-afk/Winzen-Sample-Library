/**
 * ArbitrationEngine.ts
 * 
 * Domain Micro-Module: modules/arbitration/
 * Encapsulates Director Jason's Executive Suite:
 * - High-level merchandiser commentary & directive capture
 * - Discrepancy arbitration between factory tags, buyer specs, and OCR models
 * - Model Tier Governance: Flash verification (Tier 1) vs Pro resolution (Tier 2 deep audit)
 */

import { EcosystemCoordinator } from '../../core/coordinator/EcosystemCoordinator';

export type ModelGovernanceTier = 'GEMINI_FLASH' | 'GEMINI_PRO_DEEP_AUDIT';

export interface ArbitrationCase {
  garmentId: string;
  discrepantFields: string[];
  merchandiserNotes?: string;
  directorDirective?: string;
  selectedModelTier: ModelGovernanceTier;
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  arbitratedAt?: number;
}

export class ArbitrationEngine {
  private static instance: ArbitrationEngine;
  private coordinator: EcosystemCoordinator;
  private cases: Map<string, ArbitrationCase> = new Map();

  private constructor() {
    this.coordinator = EcosystemCoordinator.getInstance();
  }

  public static getInstance(): ArbitrationEngine {
    if (!ArbitrationEngine.instance) {
      ArbitrationEngine.instance = new ArbitrationEngine();
    }
    return ArbitrationEngine.instance;
  }

  /**
   * Submit garment to Director Arbitration
   */
  public escalateToArbitration(
    garmentId: string, 
    discrepantFields: string[], 
    merchandiserNotes?: string
  ): ArbitrationCase {
    const arbCase: ArbitrationCase = {
      garmentId,
      discrepantFields,
      merchandiserNotes,
      selectedModelTier: 'GEMINI_FLASH',
      status: 'OPEN'
    };

    this.cases.set(garmentId, arbCase);

    this.coordinator.transitionState(
      garmentId, 
      'ARBITRATION_REQUIRED', 
      'Director Jason', 
      `Discrepant fields: ${discrepantFields.join(', ')}`
    );
    this.coordinator.dispatch('ARBITRATION_REQUIRED', arbCase);

    return arbCase;
  }

  /**
   * Resolve arbitration and record directive
   */
  public resolveArbitration(
    garmentId: string, 
    directive: string, 
    modelTier: ModelGovernanceTier = 'GEMINI_FLASH'
  ): boolean {
    const arbCase = this.cases.get(garmentId);
    if (!arbCase) return false;

    arbCase.directorDirective = directive;
    arbCase.selectedModelTier = modelTier;
    arbCase.status = 'RESOLVED';
    arbCase.arbitratedAt = Date.now();

    this.coordinator.transitionState(
      garmentId, 
      'QA_PENDING', 
      'Director Jason', 
      `Resolved with directive: ${directive} using ${modelTier}`
    );
    this.coordinator.dispatch('ARBITRATION_RESOLVED', arbCase);

    return true;
  }

  public getCase(garmentId: string): ArbitrationCase | null {
    return this.cases.get(garmentId) || null;
  }
}
