/**
 * QaReviewEngine.ts
 * 
 * Domain Micro-Module: modules/qa-review/
 * Encapsulates Jennifer's QA review domain:
 * - OCR spec sheet verification & fabric composition parsing
 * - Style code reconciliation (cust_style_no vs winzen_style_no)
 * - Staged proposed changes with approval transactions
 * - Rejection retake triggers dispatched to Chen's Capture Station via CaptureBridge
 * 
 * Strictly isolated from camera capture hardware logic.
 */

import { EcosystemCoordinator } from '../../core/coordinator/EcosystemCoordinator';
import { CaptureBridge } from '../../core/bridges/CaptureBridge';

export interface QaReviewProposal {
  garmentId: string;
  field: string;
  currentValue: any;
  proposedValue: any;
  confidence: number;
  source: 'OCR' | 'AI_SUGGESTION' | 'MANUAL';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export class QaReviewEngine {
  private static instance: QaReviewEngine;
  private coordinator: EcosystemCoordinator;
  private bridge: CaptureBridge;
  private stagedProposals: Map<string, QaReviewProposal[]> = new Map();

  private constructor() {
    this.coordinator = EcosystemCoordinator.getInstance();
    this.bridge = CaptureBridge.getInstance();
  }

  public static getInstance(): QaReviewEngine {
    if (!QaReviewEngine.instance) {
      QaReviewEngine.instance = new QaReviewEngine();
    }
    return QaReviewEngine.instance;
  }

  /**
   * Stage a proposed spec modification
   */
  public stageProposal(proposal: QaReviewProposal): void {
    const list = this.stagedProposals.get(proposal.garmentId) || [];
    list.push(proposal);
    this.stagedProposals.set(proposal.garmentId, list);
    this.coordinator.dispatch('QA_PENDING', { garmentId: proposal.garmentId, proposal });
  }

  /**
   * Apply approved changes to the garment spec
   */
  public async applyApprovedChanges(garmentId: string, reviewer = 'Jennifer QA'): Promise<{
    success: boolean;
    appliedCount: number;
    error?: string;
  }> {
    const proposals = this.stagedProposals.get(garmentId) || [];
    const accepted = proposals.filter(p => p.status === 'ACCEPTED' || p.status === 'PENDING');

    if (accepted.length === 0) {
      return { success: true, appliedCount: 0 };
    }

    try {
      // Build patch payload
      const updates: Record<string, any> = {};
      accepted.forEach(p => {
        updates[p.field] = p.proposedValue;
      });

      const res = await fetch(`/api/garments/${garmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Clear staged
      this.stagedProposals.delete(garmentId);

      // Transition state
      this.coordinator.transitionState(
        garmentId, 
        'CATALOG_PUBLISHED', 
        reviewer, 
        `Applied ${accepted.length} approved QA spec changes.`
      );
      this.coordinator.dispatch('QA_APPROVED', { garmentId, appliedCount: accepted.length });

      return { success: true, appliedCount: accepted.length };
    } catch (err: any) {
      return { success: false, appliedCount: 0, error: err.message };
    }
  }

  /**
   * Reject garment angle or label legibility and trigger Capture Station retake
   */
  public async flagForRetake(
    garmentId: string, 
    reason: string, 
    failedAngles: string[],
    reviewer = 'Jennifer QA'
  ): Promise<{ success: boolean; message: string }> {
    return await this.bridge.sendRetakeNotice(garmentId, reason, failedAngles, reviewer);
  }

  public getStagedProposals(garmentId: string): QaReviewProposal[] {
    return this.stagedProposals.get(garmentId) || [];
  }
}
