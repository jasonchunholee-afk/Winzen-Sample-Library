import { locationDao } from './dao/LocationDAO';
import { batchDao } from './dao/BatchDAO';
import { topologyEngine, type CabinetConfig } from './engine/TopologyEngine';
import { operationsEngine, type AssignSpaceRequest, type AssignSpaceResponse } from './engine/OperationsEngine';
import type { WarehouseLocationRecord, WarehouseBatchRecord } from './warehouseDb';

export class WarehouseFacade {
  private static instance: WarehouseFacade;
  private constructor() {}

  public static getInstance(): WarehouseFacade {
    if (!WarehouseFacade.instance) {
      WarehouseFacade.instance = new WarehouseFacade();
    }
    return WarehouseFacade.instance;
  }

  public async buildArea(areaCode: string, closeStack5InB: boolean = false): Promise<WarehouseLocationRecord[]> {
    const locations = topologyEngine.generateArea(areaCode, { closeStack5InB });
    
    const area = areaCode.toUpperCase().trim();
    for (let i = 1; i <= 20; i++) {
      await locationDao.deleteByCabinet(`${area}${i}`);
    }
    await locationDao.upsertBatch(locations);
    
    return locations;
  }

  public async buildCabinet(config: CabinetConfig): Promise<WarehouseLocationRecord[]> {
    const locations = topologyEngine.generateCabinetLocations(config);
    
    await locationDao.deleteByCabinet(config.cabinetNo);
    await locationDao.upsertBatch(locations);
    
    return locations;
  }

  public async ensureWarehouseAreasInitialized(): Promise<void> {
    const existing = await locationDao.findAll();
    if (existing.length === 0) {
      const areas = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (const area of areas) {
        await this.buildArea(area, false);
      }
    }
  }

  public async ensureDefaultCabinet(): Promise<void> {
    await this.ensureWarehouseAreasInitialized();
  }

  public async getLocations(filters?: { area?: string, cabinetNo?: string, buyer?: string, isFull?: boolean }): Promise<WarehouseLocationRecord[]> {
    await this.ensureWarehouseAreasInitialized();
    return await locationDao.findAll(filters);
  }

  public async toggleStack5(params: { cabinetNo?: string; shelfNo?: number; close: boolean }) {
    return await locationDao.toggleStack5(params);
  }

  public async updateStackInspection(locationCode: string, isFull: boolean, fullnessLevel: string, notes: string): Promise<WarehouseLocationRecord | null> {
    return await locationDao.updateFullness(locationCode, isFull, fullnessLevel, notes);
  }

  public async assignSpace(req: AssignSpaceRequest): Promise<AssignSpaceResponse> {
    return await operationsEngine.assignSpace(req);
  }

  public async shelveBatch(batchName: string, garments: { garmentId: string, assignedLocation: string }[]): Promise<WarehouseBatchRecord> {
    return await operationsEngine.executeShelvingBatch(batchName, garments);
  }

  public async getBatches(): Promise<WarehouseBatchRecord[]> {
    return await batchDao.findAll();
  }
}

export const warehouseFacade = WarehouseFacade.getInstance();
