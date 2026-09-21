/**
 * IntakeNormalizationEngine.ts
 * 
 * Domain Micro-Module: modules/intake/
 * Responsible for raw capture payload intake, photo buffer normalization,
 * temporary barcode staging (TEMP-* vs WZ-*), and lifecycle validation.
 */

import { EcosystemCoordinator } from '../../core/coordinator/EcosystemCoordinator';
import { EcosystemDiagnostics } from '../../core/diagnostics/EcosystemDiagnostics';
import { PendingGarmentCapture } from '../../core/bridges/CaptureBridge';

export interface NormalizedGarmentRecord {
  garmentId: string;
  isTemporaryBarcode: boolean;
  stagingCode: string;
  sourceStation: string;
  operator: string;
  capturedAt: number;
  normalizedImages: Array<{
    filename: string;
    role: 'Front' | 'Back' | 'Label' | 'Detail';
    url: string;
    thumbUrl: string;
    aiUrl: string;
    rawUrl: string;
  }>;
  intakeTimestamp: number;
}

export class IntakeNormalizationEngine {
  private static instance: IntakeNormalizationEngine;
  private coordinator: EcosystemCoordinator;
  private diagnostics: EcosystemDiagnostics;

  private constructor() {
    this.coordinator = EcosystemCoordinator.getInstance();
    this.diagnostics = EcosystemDiagnostics.getInstance();
  }

  public static getInstance(): IntakeNormalizationEngine {
    if (!IntakeNormalizationEngine.instance) {
      IntakeNormalizationEngine.instance = new IntakeNormalizationEngine();
    }
    return IntakeNormalizationEngine.instance;
  }

  /**
   * Normalize an incoming capture payload from CaptureBridge or local ingestion
   */
  public normalizeCapture(payload: PendingGarmentCapture): {
    success: boolean;
    normalized?: NormalizedGarmentRecord;
    errors?: string[];
  } {
    // 1. Schema Validation
    const validation = this.diagnostics.validateCapturePayload(payload);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const garmentId = payload.garmentId;
    const isTemporaryBarcode = garmentId.startsWith('TEMP-') || !!payload.temporaryStickerCode;

    // 2. Normalize 3-tier image paths
    const normalizedImages = (payload.images || []).map(img => {
      const filename = img.filename || `${garmentId} (${img.role || 'Front'}).jpg`;
      const fallbackBase = `/images/${filename}`;
      return {
        filename,
        role: (img.role || 'Front') as any,
        url: img.url || fallbackBase,
        thumbUrl: img.thumbUrl || `/images_thumb/${filename}`,
        aiUrl: img.aiUrl || `/images_ai/${filename}`,
        rawUrl: img.rawUrl || fallbackBase
      };
    });

    const normalizedRecord: NormalizedGarmentRecord = {
      garmentId,
      isTemporaryBarcode,
      stagingCode: payload.temporaryStickerCode || garmentId,
      sourceStation: payload.stationId || 'Station-1',
      operator: payload.operator || 'Chen',
      capturedAt: payload.capturedAt || Date.now(),
      normalizedImages,
      intakeTimestamp: Date.now()
    };

    // 3. Transition Lifecycle state through Coordinator
    this.coordinator.transitionState(
      garmentId, 
      'INTAKE_VALIDATED', 
      'IntakeNormalizationEngine', 
      `Normalized ${normalizedImages.length} shots. Temporary Barcode: ${isTemporaryBarcode}`
    );
    this.coordinator.dispatch('INTAKE_VALIDATED', normalizedRecord);

    return { success: true, normalized: normalizedRecord };
  }
}
