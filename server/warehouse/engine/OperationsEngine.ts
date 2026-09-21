import { locationDao } from '../dao/LocationDAO';
import { batchDao } from '../dao/BatchDAO';
import type { WarehouseLocationRecord, WarehouseBatchRecord } from '../warehouseDb';
import { CaptureTriageManager } from '../../services/CaptureTriageManager.ts';
import { db } from '../../../src/db/index.ts';
import { garments } from '../../../src/db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AssignSpaceRequest {
  garmentId?: string;
  buyer?: string | null;
  garmentType?: string | null;
  tempContainer?: string;
}

export interface AssignSpaceResponse {
  locationCode: string;
  locationName: string;
  cabinetNo: string;
  shelfNo: number;
  stackNo: number;
  assignedBuyer: string;
  tempContainer: string;
}

export class OperationsEngine {
  private static instance: OperationsEngine;
  private constructor() {}

  public static getInstance(): OperationsEngine {
    if (!OperationsEngine.instance) {
      OperationsEngine.instance = new OperationsEngine();
    }
    return OperationsEngine.instance;
  }

  public async assignSpace(req: AssignSpaceRequest): Promise<AssignSpaceResponse> {
    // Enforce Quarantine Isolation: Quarantined records must not enter active warehouse inventory
    if (req.garmentId) {
      const triageManager = CaptureTriageManager.getInstance();
      if (triageManager.isQuarantined(req.garmentId)) {
        throw new Error(`Quarantine Isolation: Garment ${req.garmentId} is quarantined (Set B / REJECTED_NO_GARMENT) and cannot be assigned warehouse space.`);
      }
      try {
        const g = await db.select().from(garments).where(eq(garments.id, req.garmentId));
        if (g.length > 0 && g[0].status === 'quarantined') {
          throw new Error(`Quarantine Isolation: Garment ${req.garmentId} is quarantined (Set B / REJECTED_NO_GARMENT) and cannot be assigned warehouse space.`);
        }
      } catch (dbErr: any) {
        if (dbErr.message?.includes('Quarantine Isolation')) {
          throw dbErr;
        }
      }
    }

    const targetBuyer = req.buyer || '';
    const tempContainer = req.tempContainer || 'Temp Box 1';

    const bestLoc = await locationDao.findAvailableStack(targetBuyer, req.garmentType || '');

    if (!bestLoc) {
      return {
        locationCode: 'A3-1-1',
        locationName: 'Cabinet A3 • Shelf 1 • Stack 1 (Fallback)',
        cabinetNo: 'A3',
        shelfNo: 1,
        stackNo: 1,
        assignedBuyer: 'Unassigned',
        tempContainer
      };
    }

    await locationDao.reservePendingSlot(bestLoc.location_code);

    return {
      locationCode: bestLoc.location_code,
      locationName: bestLoc.location_name,
      cabinetNo: bestLoc.cabinet_no,
      shelfNo: bestLoc.shelf_no,
      stackNo: bestLoc.stack_no,
      assignedBuyer: bestLoc.assigned_buyer,
      tempContainer
    };
  }

  public async executeShelvingBatch(batchName: string, garmentRecords: { garmentId: string, assignedLocation: string }[]): Promise<WarehouseBatchRecord> {
    const triageManager = CaptureTriageManager.getInstance();
    // Exclude any quarantined garments from entering active warehouse shelving
    const activeRecords = garmentRecords.filter(r => !triageManager.isQuarantined(r.garmentId));

    const batch = await batchDao.create({
      batchName,
      operator: 'Chen',
      garmentIds: activeRecords.map(g => g.garmentId)
    });

    for (const record of activeRecords) {
      if (record.assignedLocation) {
        await locationDao.releasePendingSlot(record.assignedLocation);
        await locationDao.incrementGarmentCount(record.assignedLocation, 1);
      }
    }

    const shelvedBatch = await batchDao.markShelved(batch.id);
    return shelvedBatch || batch;
  }
}

export const operationsEngine = OperationsEngine.getInstance();
