import { db } from '../../src/db';
import { warehouse_locations, warehouse_batches, type WarehouseLocation, type WarehouseBatch } from './schema';
import { eq, inArray, sql } from 'drizzle-orm';

export interface WarehouseLocationRecord {
  id: string;
  location_code: string;
  location_name: string;
  cabinet_no: string;
  shelf_no: number;
  stack_no: number;
  assigned_buyer: string;
  assigned_type: string;
  max_capacity_units: number;
  current_count: number;
  pending_assigned_count: number;
  is_full: number;
  fullness_level?: string;
  full_evidence_notes?: string;
  last_photo_url?: string;
  is_active: number;
  stack_width_cm?: number;
  stack_depth_cm?: number;
  is_partitioned?: number;
  is_closed?: number;
  assignment_mode?: 'Manual' | 'Auto';
  created_at: string;
  updated_at: string;
}

export interface WarehouseBatchRecord {
  id: string;
  batch_name: string;
  operator: string;
  status: 'pending' | 'shelving' | 'shelved' | 'cancelled';
  garment_count: number;
  temp_container: string;
  garment_ids: string[];
  created_at: string;
  shelved_at?: string;
}

// Convert Drizzle location to WarehouseLocationRecord interface
function mapLocation(row: WarehouseLocation): WarehouseLocationRecord {
  return {
    id: String(row.id),
    location_code: row.location_code,
    location_name: row.location_name || '',
    cabinet_no: row.cabinet_no,
    shelf_no: row.shelf_no,
    stack_no: row.stack_no,
    assigned_buyer: row.assigned_buyer || '',
    assigned_type: row.assigned_type || '',
    max_capacity_units: row.max_capacity_units || 0,
    current_count: row.current_count || 0,
    pending_assigned_count: row.pending_assigned_count || 0,
    is_full: row.is_full || 0,
    fullness_level: row.fullness_level || 'AVAILABLE',
    full_evidence_notes: row.full_evidence_notes || '',
    last_photo_url: row.last_photo_url || '',
    is_active: row.is_active || 1,
    stack_width_cm: row.stack_width_cm || 26,
    stack_depth_cm: row.stack_depth_cm || 40,
    is_partitioned: row.is_partitioned || 0,
    is_closed: row.is_closed || 0,
    assignment_mode: (row.assignment_mode as 'Manual' | 'Auto') || 'Manual',
    created_at: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString()
  };
}

// Convert Drizzle batch to WarehouseBatchRecord interface
function mapBatch(row: WarehouseBatch): WarehouseBatchRecord {
  return {
    id: String(row.id),
    batch_name: row.batch_no,
    operator: row.operator || '',
    status: (row.status as any) || 'pending',
    garment_count: row.garment_count || 0,
    temp_container: row.temp_container || '',
    garment_ids: row.garment_ids ? JSON.parse(row.garment_ids) : [],
    created_at: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    shelved_at: row.completed_at ? row.completed_at.toISOString() : undefined
  };
}

class WarehouseDatastore {
  private static instance: WarehouseDatastore;
  
  private constructor() {}

  public static getInstance(): WarehouseDatastore {
    if (!WarehouseDatastore.instance) {
      WarehouseDatastore.instance = new WarehouseDatastore();
    }
    return WarehouseDatastore.instance;
  }

  // Location Access Operations
  public async getAllLocations(): Promise<WarehouseLocationRecord[]> {
    const rows = await db.select().from(warehouse_locations);
    return rows.map(mapLocation);
  }

  public async getLocationByCode(code: string): Promise<WarehouseLocationRecord | undefined> {
    const rows = await db.select().from(warehouse_locations).where(eq(warehouse_locations.location_code, code.toUpperCase()));
    return rows.length > 0 ? mapLocation(rows[0]) : undefined;
  }

  public async upsertLocations(newLocations: WarehouseLocationRecord[]): Promise<void> {
    if (newLocations.length === 0) return;
    
    // Convert to Drizzle insert format
    const toInsert = newLocations.map(n => ({
      location_code: n.location_code.toUpperCase(),
      location_name: n.location_name,
      cabinet_no: n.cabinet_no.toUpperCase(),
      shelf_no: n.shelf_no,
      stack_no: n.stack_no,
      assigned_buyer: n.assigned_buyer,
      assigned_type: n.assigned_type,
      max_capacity_units: n.max_capacity_units,
      current_count: n.current_count,
      pending_assigned_count: n.pending_assigned_count,
      is_full: n.is_full,
      fullness_level: n.fullness_level,
      full_evidence_notes: n.full_evidence_notes,
      last_photo_url: n.last_photo_url,
      is_active: n.is_active,
      stack_width_cm: n.stack_width_cm,
      stack_depth_cm: n.stack_depth_cm,
      is_partitioned: n.is_partitioned,
      is_closed: n.is_closed,
      assignment_mode: n.assignment_mode,
      updated_at: new Date()
    }));
    
    await db.insert(warehouse_locations).values(toInsert).onConflictDoUpdate({
      target: warehouse_locations.location_code,
      set: {
        location_name: sql`excluded.location_name`,
        assigned_buyer: sql`excluded.assigned_buyer`,
        assigned_type: sql`excluded.assigned_type`,
        max_capacity_units: sql`excluded.max_capacity_units`,
        current_count: sql`excluded.current_count`,
        pending_assigned_count: sql`excluded.pending_assigned_count`,
        is_full: sql`excluded.is_full`,
        fullness_level: sql`excluded.fullness_level`,
        is_active: sql`excluded.is_active`,
        is_closed: sql`excluded.is_closed`,
        assignment_mode: sql`excluded.assignment_mode`,
        updated_at: new Date()
      }
    });
  }

  public async updateLocation(code: string, updates: Partial<WarehouseLocationRecord>): Promise<WarehouseLocationRecord | null> {
    const mappedUpdates: any = { updated_at: new Date() };
    if (updates.current_count !== undefined) mappedUpdates.current_count = updates.current_count;
    if (updates.pending_assigned_count !== undefined) mappedUpdates.pending_assigned_count = updates.pending_assigned_count;
    if (updates.is_full !== undefined) mappedUpdates.is_full = updates.is_full;
    if (updates.fullness_level !== undefined) mappedUpdates.fullness_level = updates.fullness_level;
    if (updates.full_evidence_notes !== undefined) mappedUpdates.full_evidence_notes = updates.full_evidence_notes;
    if (updates.is_closed !== undefined) mappedUpdates.is_closed = updates.is_closed;
    if (updates.is_active !== undefined) mappedUpdates.is_active = updates.is_active;
    if (updates.assignment_mode !== undefined) mappedUpdates.assignment_mode = updates.assignment_mode;
    
    const rows = await db.update(warehouse_locations)
      .set(mappedUpdates)
      .where(eq(warehouse_locations.location_code, code.toUpperCase()))
      .returning();
      
    return rows.length > 0 ? mapLocation(rows[0]) : null;
  }

  public async deleteCabinetLocations(cabinetNo: string): Promise<void> {
    await db.delete(warehouse_locations).where(eq(warehouse_locations.cabinet_no, cabinetNo.toUpperCase()));
  }

  // Batch Operations
  public async getAllBatches(): Promise<WarehouseBatchRecord[]> {
    const rows = await db.select().from(warehouse_batches);
    return rows.map(mapBatch);
  }

  public async addBatch(batch: WarehouseBatchRecord): Promise<void> {
    await db.insert(warehouse_batches).values({
      batch_no: batch.batch_name,
      operator: batch.operator,
      garment_count: batch.garment_count,
      temp_container: batch.temp_container,
      garment_ids: JSON.stringify(batch.garment_ids),
      status: batch.status,
      created_at: new Date()
    });
  }

  public async updateBatch(id: string, updates: Partial<WarehouseBatchRecord>): Promise<WarehouseBatchRecord | null> {
    const mappedUpdates: any = {};
    if (updates.status) mappedUpdates.status = updates.status;
    if (updates.shelved_at) mappedUpdates.completed_at = new Date(updates.shelved_at);
    
    // Note: The interface defines id as string, but DB has it as serial (integer). Let's assume id here is actually a DB id.
    const batchId = parseInt(id.replace('BATCH-', '')); // Fallback for old formatting if necessary
    
    const rows = await db.update(warehouse_batches)
      .set(mappedUpdates)
      // We will try to match on batch_no if id is prefixed, otherwise assume id.
      .where(id.startsWith('BATCH') ? eq(warehouse_batches.batch_no, id) : eq(warehouse_batches.id, parseInt(id) || 0))
      .returning();
      
    return rows.length > 0 ? mapBatch(rows[0]) : null;
  }
}

export const warehouseStore = WarehouseDatastore.getInstance();
