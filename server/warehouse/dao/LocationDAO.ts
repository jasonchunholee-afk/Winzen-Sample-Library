import { warehouseStore, type WarehouseLocationRecord } from '../warehouseDb';

export interface LocationFilter {
  area?: string;
  cabinetNo?: string;
  buyer?: string;
  garmentType?: string;
  isFull?: boolean;
}

export class LocationDAO {
  private static instance: LocationDAO;
  private constructor() {}

  public static getInstance(): LocationDAO {
    if (!LocationDAO.instance) {
      LocationDAO.instance = new LocationDAO();
    }
    return LocationDAO.instance;
  }

  public async findAll(filter?: LocationFilter): Promise<WarehouseLocationRecord[]> {
    let list = await warehouseStore.getAllLocations();
    if (!filter) return list;

    if (filter.area) {
      const a = filter.area.toUpperCase().trim();
      list = list.filter(l => l.cabinet_no.toUpperCase().startsWith(a));
    }
    if (filter.cabinetNo) {
      const c = filter.cabinetNo.toUpperCase();
      list = list.filter(l => l.cabinet_no.toUpperCase() === c);
    }
    if (filter.buyer) {
      const b = filter.buyer.toUpperCase();
      list = list.filter(l => l.assigned_buyer.toUpperCase() === b || l.assigned_buyer === 'All' || l.assigned_buyer === 'Unassigned');
    }
    if (filter.isFull !== undefined) {
      const fullVal = filter.isFull ? 1 : 0;
      list = list.filter(l => l.is_full === fullVal);
    }
    return list;
  }

  public async findByCode(locationCode: string): Promise<WarehouseLocationRecord | null> {
    return (await warehouseStore.getLocationByCode(locationCode)) || null;
  }

  public async findAvailableStack(buyer?: string, garmentType?: string): Promise<WarehouseLocationRecord | null> {
    const all = await warehouseStore.getAllLocations();
    const activeOpen = all.filter(l => l.is_active === 1 && l.is_full === 0);
    const targetBuyer = (buyer || '').trim().toUpperCase();

    if (targetBuyer) {
      const exactMatch = activeOpen.find(l => 
        l.assigned_buyer.toUpperCase() === targetBuyer &&
        (l.current_count + (l.pending_assigned_count || 0)) < l.max_capacity_units
      );
      if (exactMatch) return exactMatch;
    }

    const generalMatch = activeOpen.find(l => 
      (l.assigned_buyer === 'Unassigned' || l.assigned_buyer === 'All' || !l.assigned_buyer) &&
      (l.current_count + (l.pending_assigned_count || 0)) < l.max_capacity_units
    );
    if (generalMatch) return generalMatch;

    if (activeOpen.length > 0) {
      return activeOpen.sort((a, b) => 
        (a.current_count + (a.pending_assigned_count || 0)) - (b.current_count + (b.pending_assigned_count || 0))
      )[0];
    }
    return null;
  }

  public async upsertBatch(locations: WarehouseLocationRecord[]): Promise<void> {
    await warehouseStore.upsertLocations(locations);
  }

  public async incrementGarmentCount(locationCode: string, delta: number = 1): Promise<WarehouseLocationRecord | null> {
    const loc = await this.findByCode(locationCode);
    if (!loc) return null;
    
    const newCount = Math.max(0, loc.current_count + delta);
    const isFull = newCount >= loc.max_capacity_units ? 1 : 0;
    
    return await warehouseStore.updateLocation(locationCode, {
      current_count: newCount,
      is_full: isFull
    });
  }

  public async reservePendingSlot(locationCode: string): Promise<WarehouseLocationRecord | null> {
    const loc = await this.findByCode(locationCode);
    if (!loc) return null;
    return await warehouseStore.updateLocation(locationCode, {
      pending_assigned_count: (loc.pending_assigned_count || 0) + 1
    });
  }

  public async releasePendingSlot(locationCode: string): Promise<WarehouseLocationRecord | null> {
    const loc = await this.findByCode(locationCode);
    if (!loc) return null;
    return await warehouseStore.updateLocation(locationCode, {
      pending_assigned_count: Math.max(0, (loc.pending_assigned_count || 0) - 1)
    });
  }

  public async updateFullness(
    locationCode: string,
    isFull: boolean,
    fullnessLevel: string,
    evidenceNotes?: string
  ): Promise<WarehouseLocationRecord | null> {
    return await warehouseStore.updateLocation(locationCode, {
      is_full: isFull ? 1 : 0,
      fullness_level: fullnessLevel,
      full_evidence_notes: evidenceNotes
    });
  }

  public async updateByCode(locationCode: string, updates: Partial<WarehouseLocationRecord>): Promise<WarehouseLocationRecord | null> {
    return await warehouseStore.updateLocation(locationCode, updates);
  }

  public async deleteByCabinet(cabinetNo: string): Promise<void> {
    await warehouseStore.deleteCabinetLocations(cabinetNo);
  }

  public async toggleStack5(params: { cabinetNo?: string; shelfNo?: number; close: boolean }): Promise<{ affected: number; cabinetNo?: string }> {
    const all = await warehouseStore.getAllLocations();
    let count = 0;
    
    for (const loc of all) {
      const isTargetCabinet = !params.cabinetNo || loc.cabinet_no.toUpperCase() === params.cabinetNo.toUpperCase();
      const isTargetShelf = params.shelfNo === undefined || loc.shelf_no === Number(params.shelfNo);
      const isStack5 = loc.stack_no === 5;
      
      if (isTargetCabinet && isTargetShelf && isStack5) {
        await warehouseStore.updateLocation(loc.location_code, {
          is_closed: params.close ? 1 : 0,
          is_active: params.close ? 0 : 1,
          fullness_level: params.close ? 'CLOSED' : (loc.current_count > 0 ? 'AVAILABLE' : 'EMPTY')
        });
        count++;
      }
    }
    return { affected: count, cabinetNo: params.cabinetNo };
  }
}

export const locationDao = LocationDAO.getInstance();
