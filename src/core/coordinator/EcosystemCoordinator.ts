/**
 * EcosystemCoordinator.ts
 * 
 * Central Event & Workflow Hub for the Winzen Digitization Ecosystem.
 * Enforces the explicit Garment State Lifecycle:
 * CAPTURED ➔ INTAKE_VALIDATED ➔ OCR_PARSED ➔ QA_PENDING ➔ ARBITRATION_REQUIRED ➔ CATALOG_PUBLISHED
 * 
 * Decouples domain modules (Intake, QA-Review, Arbitration, Catalog)
 * through a unified, type-safe event dispatcher.
 */

export type GarmentLifecycleState = 
  | 'CAPTURED'
  | 'INTAKE_VALIDATED'
  | 'OCR_PARSED'
  | 'QA_PENDING'
  | 'ARBITRATION_REQUIRED'
  | 'CATALOG_PUBLISHED'
  | 'RETAKE_REQUESTED';

export interface GarmentLifecycleRecord {
  garmentId: string;
  state: GarmentLifecycleState;
  updatedAt: number;
  history: Array<{
    state: GarmentLifecycleState;
    timestamp: number;
    actor?: string;
    note?: string;
  }>;
  payload?: any;
}

export type EcosystemEvent = 
  | 'CAPTURE_RECEIVED'
  | 'INTAKE_VALIDATED'
  | 'OCR_PARSED'
  | 'QA_PENDING'
  | 'QA_APPROVED'
  | 'QA_FLAGGED_RETAKE'
  | 'ARBITRATION_REQUIRED'
  | 'ARBITRATION_RESOLVED'
  | 'CATALOG_PUBLISHED'
  | 'STATE_CHANGED'
  | 'DIAGNOSTIC_ALERT';

export type EventHandler<T = any> = (payload: T) => void;

export class EcosystemCoordinator {
  private static instance: EcosystemCoordinator;
  private listeners: Map<EcosystemEvent, Set<EventHandler>> = new Map();
  private records: Map<string, GarmentLifecycleRecord> = new Map();

  // Valid State Transition Graph
  private allowedTransitions: Record<GarmentLifecycleState, GarmentLifecycleState[]> = {
    'CAPTURED': ['INTAKE_VALIDATED', 'RETAKE_REQUESTED'],
    'INTAKE_VALIDATED': ['OCR_PARSED', 'RETAKE_REQUESTED'],
    'OCR_PARSED': ['QA_PENDING', 'RETAKE_REQUESTED'],
    'QA_PENDING': ['CATALOG_PUBLISHED', 'ARBITRATION_REQUIRED', 'RETAKE_REQUESTED'],
    'ARBITRATION_REQUIRED': ['CATALOG_PUBLISHED', 'QA_PENDING', 'RETAKE_REQUESTED'],
    'CATALOG_PUBLISHED': ['QA_PENDING', 'RETAKE_REQUESTED'], // Can be reopened for revision
    'RETAKE_REQUESTED': ['CAPTURED'] // Cycles back upon re-shooting
  };

  private constructor() {}

  public static getInstance(): EcosystemCoordinator {
    if (!EcosystemCoordinator.instance) {
      EcosystemCoordinator.instance = new EcosystemCoordinator();
    }
    return EcosystemCoordinator.instance;
  }

  /**
   * Subscribe to ecosystem events
   */
  public on<T = any>(event: EcosystemEvent, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from ecosystem events
   */
  public off<T = any>(event: EcosystemEvent, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Dispatch an ecosystem event to all registered listeners
   */
  public dispatch<T = any>(event: EcosystemEvent, payload: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[EcosystemCoordinator] Error in listener for event ${event}:`, err);
        }
      });
    }
  }

  /**
   * Transition a garment through the lifecycle machine
   */
  public transitionState(
    garmentId: string, 
    nextState: GarmentLifecycleState, 
    actor?: string, 
    note?: string
  ): { success: boolean; error?: string; record?: GarmentLifecycleRecord } {
    let currentRecord = this.records.get(garmentId);

    if (!currentRecord) {
      // First registration into lifecycle
      currentRecord = {
        garmentId,
        state: nextState,
        updatedAt: Date.now(),
        history: [{
          state: nextState,
          timestamp: Date.now(),
          actor: actor || 'System',
          note: note || 'Initial registration'
        }]
      };
      this.records.set(garmentId, currentRecord);
      this.dispatch('STATE_CHANGED', currentRecord);
      return { success: true, record: currentRecord };
    }

    const currentState = currentRecord.state;
    const allowed = this.allowedTransitions[currentState] || [];

    if (!allowed.includes(nextState)) {
      const errorMsg = `Invalid state transition from ${currentState} to ${nextState} for garment ${garmentId}.`;
      console.warn(`[EcosystemCoordinator] ${errorMsg}`);
      return { success: false, error: errorMsg, record: currentRecord };
    }

    currentRecord.state = nextState;
    currentRecord.updatedAt = Date.now();
    currentRecord.history.push({
      state: nextState,
      timestamp: Date.now(),
      actor: actor || 'Coordinator',
      note: note || ''
    });

    this.dispatch('STATE_CHANGED', currentRecord);
    return { success: true, record: currentRecord };
  }

  /**
   * Retrieve current lifecycle status of a garment
   */
  public getGarmentState(garmentId: string): GarmentLifecycleRecord | null {
    return this.records.get(garmentId) || null;
  }

  /**
   * Get all registered garment lifecycle records
   */
  public getAllRecords(): GarmentLifecycleRecord[] {
    return Array.from(this.records.values());
  }
}
