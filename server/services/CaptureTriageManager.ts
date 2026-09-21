import fs from 'fs';
import path from 'path';
import { db } from '../../src/db/index.ts';
import { fgd_observations, garments, images } from '../../src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import { CaptureTriageResult } from './CaptureAiInspector.ts';

export class CaptureTriageManager {
  private static instance: CaptureTriageManager;
  private filePath: string;
  private logs: Map<string, CaptureTriageResult> = new Map();

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'capture_triage_logs.json');
    this.ensureDataDir();
    this.loadFromDisk();
  }

  public static getInstance(): CaptureTriageManager {
    if (!CaptureTriageManager.instance) {
      CaptureTriageManager.instance = new CaptureTriageManager();
    }
    return CaptureTriageManager.instance;
  }

  private ensureDataDir(): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  public loadFromDisk(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list: CaptureTriageResult[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.logs.clear();
          for (const item of list) {
            if (item?.filename) {
              this.logs.set(item.filename, item);
            }
          }
        }
      } catch (err) {
        console.warn('[CaptureTriageManager] Error reading disk logs:', err);
      }
    }
  }

  private saveToDisk(): void {
    try {
      this.ensureDataDir();
      const list = Array.from(this.logs.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[CaptureTriageManager] Error persisting to disk:', err);
    }
  }

  /**
   * Persist a triage verdict to both durable disk storage and PostgreSQL
   */
  public async recordTriage(result: CaptureTriageResult): Promise<void> {
    this.logs.set(result.filename, result);
    this.saveToDisk();

    // Persist to PostgreSQL fgd_observations
    try {
      const obsId = 'triage_' + result.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
      const payload = JSON.stringify({
        filename: result.filename,
        garmentId: result.garmentId,
        setClassification: result.setClassification,
        status: result.status,
        rejectionReason: result.rejectionReason,
        confidence: result.confidence,
        isGarmentOrCard: result.isGarmentOrCard,
        details: result.details,
        hasCareCardOrLabel: result.hasCareCardOrLabel,
        detectedStyleNo: result.detectedStyleNo,
        detectedNotes: result.detectedNotes,
        timestamp: new Date().toISOString()
      });

      await db.insert(fgd_observations).values({
        id: obsId,
        item_code: result.garmentId || result.filename,
        observation_text: payload,
        submitted_by: 'Capture Quality Gate',
        timestamp: new Date()
      }).onConflictDoUpdate({
        target: fgd_observations.id,
        set: {
          observation_text: sql`excluded.observation_text`,
          timestamp: sql`excluded.timestamp`
        }
      });
    } catch (pgErr) {
      console.warn('[CaptureTriageManager] Warning writing to PostgreSQL observations:', pgErr);
    }
  }

  public getAllLogs(): CaptureTriageResult[] {
    return Array.from(this.logs.values()).reverse();
  }

  public getQuarantined(): CaptureTriageResult[] {
    return Array.from(this.logs.values()).filter(l => l.status === 'quarantined');
  }

  public isQuarantined(identifier: string): boolean {
    if (!identifier) return false;
    const clean = identifier.trim();

    // 1. Direct filename match
    const byFile = this.logs.get(clean);
    if (byFile && byFile.status === 'quarantined') return true;

    // 2. Check if all shots for this garment are quarantined
    const garmentLogs = Array.from(this.logs.values()).filter(l => l.garmentId === clean);
    if (garmentLogs.length > 0 && garmentLogs.every(l => l.status === 'quarantined')) {
      return true;
    }

    return false;
  }

  public async releaseQuarantine(filename: string): Promise<boolean> {
    const existing = this.logs.get(filename);
    if (!existing) return false;

    existing.status = 'active';
    existing.setClassification = 'Set A';
    existing.rejectionReason = null;
    existing.details = 'Manually released from quarantine by QA Operator.';

    this.logs.set(filename, existing);
    this.saveToDisk();

    // If garment status was quarantined, check if it can be restored to Draft
    if (existing.garmentId && existing.garmentId !== 'UNKNOWN') {
      try {
        await db.update(garments).set({
          status: 'Draft',
          reviewer_feedback: 'Released from quarantine by QA Operator'
        }).where(eq(garments.id, existing.garmentId));
      } catch (err) {
        console.warn('[CaptureTriageManager] Error updating garment on release:', err);
      }
    }

    return true;
  }

  public async discardQuarantine(filename: string): Promise<boolean> {
    const existing = this.logs.get(filename);
    if (!existing) return false;

    this.logs.delete(filename);
    this.saveToDisk();

    try {
      await db.delete(images).where(eq(images.filename, filename));
    } catch (err) {
      console.warn('[CaptureTriageManager] Error removing image record on discard:', err);
    }

    return true;
  }
}
