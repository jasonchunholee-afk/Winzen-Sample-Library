const fs = require('fs');

let content = fs.readFileSync('server/services/EquatedCodeManager.ts', 'utf-8');

content = content.replace("import fs from 'fs';\nimport path from 'path';\n\nexport interface EquatedCodeRecord {",
`import { db } from '../../src/db/index.ts';
import { equated_codes } from '../../src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';

export interface EquatedCodeRecord {`);

content = content.replace(/private constructor\(\) \{[\s\S]*?this\.loadFromDisk\(\);\n  \}/g,
`  private constructor() {
    this.loadFromDisk();
  }`);

content = content.replace(/private loadFromDisk\(\): void \{[\s\S]*?\}\n  \}/g,
`  public async loadFromDisk(): Promise<void> {
    try {
      const rows = await db.select().from(equated_codes);
      this.records.clear();
      for (const item of rows) {
        let record = {
          previous_code: item.source_code,
          corrected_code: item.target_code,
          equated_by: 'Jennifer',
          equated_at: item.created_at ? item.created_at.toISOString() : new Date().toISOString(),
          reference_notes: '',
          previous_garment_type: item.category || 'size'
        };
        // parse additional fields if we stored them in a certain way, or just set defaults.
        this.records.set(item.source_code.toUpperCase(), record);
      }
    } catch (err) {
      console.warn('[EquatedCodeManager] Error loading equated codes from db:', err);
    }
  }`);

content = content.replace(/private saveToDisk\(\): void \{[\s\S]*?\}\n  \}/g,
`  private async saveToDisk(): Promise<void> {
    try {
      const list = Array.from(this.records.values());
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
            target_code: sql\`excluded.target_code\`,
            category: sql\`excluded.category\`
          }
        });
      }
    } catch (err) {
      console.error('[EquatedCodeManager] Error persisting equated codes to db:', err);
    }
  }`);

content = content.replace(/public equateCode\(record: EquatedCodeRecord\): EquatedCodeRecord \{[\s\S]*?return cleanRecord;\n  \}/g,
`  public async equateCode(record: EquatedCodeRecord): Promise<EquatedCodeRecord> {
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
  }`);

fs.writeFileSync('server/services/EquatedCodeManager.ts', content);
