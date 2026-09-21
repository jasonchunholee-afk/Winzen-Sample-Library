import crypto from 'crypto';
import { db } from '../../src/db/index.ts';
import { warehouse_logic_logs, global_warehouse_logic } from './schema';
import { eq, desc } from 'drizzle-orm';

export interface OrganisationLogicLog {
  id: string;
  garment_id: string;
  location_code: string;
  logic_text: string;
  assigned_by: string;
  timestamp: string;
}

export interface GlobalOrganisationLogic {
  id: string;
  logic_text: string;
  updated_by: string;
  updated_at: string;
}

class WarehouseLogicDatastore {
  public async addLog(log: Omit<OrganisationLogicLog, 'id' | 'timestamp'>): Promise<OrganisationLogicLog> {
    const id = crypto.randomUUID();
    const [newLog] = await db.insert(warehouse_logic_logs).values({
      id,
      garment_id: log.garment_id,
      location_code: log.location_code,
      logic_text: log.logic_text,
      assigned_by: log.assigned_by,
    }).returning();
    
    return {
      ...newLog,
      timestamp: newLog.timestamp.toISOString()
    };
  }

  public async getLogs(limit: number = 100): Promise<OrganisationLogicLog[]> {
    const logs = await db.select()
      .from(warehouse_logic_logs)
      .orderBy(desc(warehouse_logic_logs.timestamp))
      .limit(limit);
      
    return logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    }));
  }

  public async getAllLogs(): Promise<OrganisationLogicLog[]> {
    const logs = await db.select()
      .from(warehouse_logic_logs)
      .orderBy(desc(warehouse_logic_logs.timestamp));
      
    return logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    }));
  }

  public async getGlobalLogic(): Promise<GlobalOrganisationLogic | null> {
    const logics = await db.select()
      .from(global_warehouse_logic)
      .orderBy(desc(global_warehouse_logic.updated_at))
      .limit(1);
      
    if (logics.length === 0) return null;
    
    return {
      ...logics[0],
      updated_at: logics[0].updated_at.toISOString()
    };
  }

  public async updateGlobalLogic(logicText: string, updatedBy: string): Promise<GlobalOrganisationLogic> {
    const id = crypto.randomUUID();
    const [logic] = await db.insert(global_warehouse_logic).values({
      id,
      logic_text: logicText,
      updated_by: updatedBy,
    }).returning();
    
    return {
      ...logic,
      updated_at: logic.updated_at.toISOString()
    };
  }
}

export const warehouseLogicDb = new WarehouseLogicDatastore();
