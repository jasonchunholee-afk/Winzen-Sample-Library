import { warehouseStore, type WarehouseBatchRecord } from '../warehouseDb';

export class BatchDAO {
  private static instance: BatchDAO;
  private constructor() {}

  public static getInstance(): BatchDAO {
    if (!BatchDAO.instance) {
      BatchDAO.instance = new BatchDAO();
    }
    return BatchDAO.instance;
  }

  public async findAll(): Promise<WarehouseBatchRecord[]> {
    return await warehouseStore.getAllBatches();
  }

  public async findById(id: string): Promise<WarehouseBatchRecord | null> {
    const list = await warehouseStore.getAllBatches();
    return list.find(b => b.id === id) || null;
  }

  public async findPending(): Promise<WarehouseBatchRecord[]> {
    const list = await warehouseStore.getAllBatches();
    return list.filter(b => b.status === 'pending');
  }

  public async create(data: {
    batchName: string;
    operator?: string;
    garmentIds: string[];
    tempContainer?: string;
  }): Promise<WarehouseBatchRecord> {
    const id = `BATCH-${Date.now()}`;
    const newBatch: WarehouseBatchRecord = {
      id,
      batch_name: data.batchName,
      operator: data.operator || 'Chen',
      status: 'pending',
      garment_count: data.garmentIds.length,
      temp_container: data.tempContainer || 'Temp Box 1',
      garment_ids: data.garmentIds,
      created_at: new Date().toISOString()
    };
    await warehouseStore.addBatch(newBatch);
    return newBatch;
  }

  public async markShelved(id: string): Promise<WarehouseBatchRecord | null> {
    return await warehouseStore.updateBatch(id, {
      status: 'shelved',
      shelved_at: new Date().toISOString()
    });
  }
}

export const batchDao = BatchDAO.getInstance();
