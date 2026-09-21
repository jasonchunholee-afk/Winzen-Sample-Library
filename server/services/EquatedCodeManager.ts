import { db } from '../../src/db/index.ts';
import { equated_codes } from '../../src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export interface EquatedCodeRecord {
  previous_code: string;
  corrected_code: string;
  equated_by: string;
  equated_at: string;
  reference_notes?: string;
  previous_garment_type?: string;
}

export class EquatedCodeManager {
  private static instance: EquatedCodeManager;
  private filePath: string;
  private records: Map<string, EquatedCodeRecord> = new Map();

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'equated_codes.json');
    this.loadFromDisk();
  }

  public static getInstance(): EquatedCodeManager {
    if (!EquatedCodeManager.instance) {
      EquatedCodeManager.instance = new EquatedCodeManager();
    }
    return EquatedCodeManager.instance;
  }

  public async loadFromDisk(): Promise<void> {
    const loadFromDiskFile = () => {
      if (fs.existsSync(this.filePath)) {
        try {
          const raw = fs.readFileSync(this.filePath, 'utf8');
          const list: EquatedCodeRecord[] = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item?.previous_code) {
                this.records.set(item.previous_code.toUpperCase(), item);
              }
            }
            return true;
          }
        } catch (e) {
          console.warn('[EquatedCodeManager] Warning reading disk fallback:', e);
        }
      }
      return false;
    };

    try {
      const rows = await db.select().from(equated_codes);
      if (rows && rows.length > 0) {
        this.records.clear();
        for (const item of rows) {
          const record: EquatedCodeRecord = {
            previous_code: item.source_code,
            corrected_code: item.target_code,
            equated_by: 'Jennifer',
            equated_at: item.created_at ? item.created_at.toISOString() : new Date().toISOString(),
            reference_notes: '',
            previous_garment_type: item.category || 'size'
          };
          this.records.set(item.source_code.toUpperCase(), record);
        }
        try {
          fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.records.values()), null, 2), 'utf8');
        } catch {}
      } else {
        loadFromDiskFile();
      }
    } catch (err) {
      loadFromDiskFile();
    }
  }

  private async saveToDisk(): Promise<void> {
    const list = Array.from(this.records.values());
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (fsErr) {
      console.warn('[EquatedCodeManager] Disk write error:', fsErr);
    }

    try {
      const toInsert = list.map(item => ({
        id: 'eq_' + item.previous_code,
        source_code: item.previous_code,
        target_code: item.corrected_code,
        category: item.previous_garment_type || 'size',
        created_at: new Date(item.equated_at)
      }));
      
      if (toInsert.length > 0) {
        await db.insert(equated_codes).values(toInsert).onConflictDoUpdate({
          target: equated_codes.id,
          set: {
            target_code: sql`excluded.target_code`,
            category: sql`excluded.category`
          }
        });
      }
    } catch (err) {
      console.error('[EquatedCodeManager] Error persisting equated codes to db:', err);
    }
  }

  public async equateCode(record: EquatedCodeRecord): Promise<EquatedCodeRecord> {
    const cleanRecord: EquatedCodeRecord = {
      previous_code: record.previous_code.trim().toUpperCase(),
      corrected_code: record.corrected_code.trim().toUpperCase(),
      equated_by: record.equated_by.trim() || 'Jennifer',
      equated_at: record.equated_at || new Date().toISOString(),
      reference_notes: record.reference_notes?.trim() || '',
      previous_garment_type: record.previous_garment_type || ''
    };
    this.records.set(cleanRecord.previous_code, cleanRecord);
    await this.saveToDisk();
    return cleanRecord;
  }

  public getAll(): EquatedCodeRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(b.equated_at).getTime() - new Date(a.equated_at).getTime()
    );
  }

  public findByPreviousCode(code: string): EquatedCodeRecord | undefined {
    return this.records.get(code.trim().toUpperCase());
  }

  public findByCorrectedCode(code: string): EquatedCodeRecord | undefined {
    const target = code.trim().toUpperCase();
    for (const record of this.records.values()) {
      if (record.corrected_code === target) {
        return record;
      }
    }
    return undefined;
  }

  public searchCodes(query: string): EquatedCodeRecord[] {
    const q = query.trim().toUpperCase();
    if (!q) return this.getAll();
    return this.getAll().filter(
      r => r.previous_code.includes(q) || r.corrected_code.includes(q) || (r.reference_notes && r.reference_notes.toUpperCase().includes(q))
    );
  }
}
