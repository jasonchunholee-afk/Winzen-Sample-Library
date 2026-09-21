import { FgdEngine, GarmentTestReport, RuleAmendment } from './FgdEngine.ts';
import { db } from '../../src/db/index.ts';
import { fgd_reports, labeling_rules } from '../../src/db/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export interface FgdJobLog {
  timestamp: string;
  elapsedSec: number;
  level: 'INFO' | 'STEP' | 'SUCCESS' | 'WARN' | 'ERROR';
  garmentId?: string;
  step?: string;
  message: string;
}

export interface FgdJobState {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'aborted';
  startedAt: number;
  endedAt?: number;
  elapsedSeconds: number;
  currentGarmentIndex: number;
  totalGarments: number;
  currentGarmentId?: string;
  currentStepDescription?: string;
  garmentIds: string[];
  maxLoops: number;
  isReviewRun?: boolean;
  logs: FgdJobLog[];
  reports: GarmentTestReport[];
  error?: string;
}

/**
 * FgdJobManager - Background Thread/Task Execution Engine
 */
export class FgdJobManager {
  private static instance: FgdJobManager;
  private activeJob: FgdJobState | null = null;
  private jobHistory: FgdJobState[] = [];
  private savedReports: GarmentTestReport[] = [];
  private abortRequested: boolean = false;
  private fgdEngine: FgdEngine;

  private constructor() {
    this.fgdEngine = new FgdEngine();
    this.loadSavedReportsFromDisk();
  }

  private async loadSavedReportsFromDisk(retries: number = 2): Promise<void> {
    const diskPath = path.join(process.cwd(), 'data', 'fgd_test_reports.json');
    const loadFromDiskFile = () => {
      if (fs.existsSync(diskPath)) {
        try {
          const raw = fs.readFileSync(diskPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.savedReports = parsed as GarmentTestReport[];
            const defaultJob: FgdJobState = {
              id: 'job_saved_' + Date.now(),
              status: 'completed',
              startedAt: Date.now() - 60000,
              endedAt: Date.now(),
              elapsedSeconds: 201.7,
              currentGarmentIndex: this.savedReports.length - 1,
              totalGarments: this.savedReports.length,
              currentGarmentId: this.savedReports[0]?.garment_id || '',
              currentStepDescription: `Saved evaluation report (${this.savedReports.length} garment(s) evaluated)`,
              garmentIds: this.savedReports.map(r => r.garment_id),
              maxLoops: 2,
              logs: [],
              reports: this.savedReports
            };
            this.activeJob = defaultJob;
            this.jobHistory.push(defaultJob);
            return true;
          }
        } catch (e) {
          console.warn('[FgdJobManager] Failed reading disk fallback:', e);
        }
      }
      return false;
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const rows = await db.select().from(fgd_reports).orderBy(desc(fgd_reports.created_at));
        if (rows && rows.length > 0) {
          const parsed = rows.map(r => {
            try { return JSON.parse(r.report_data); } catch { return null; }
          }).filter(r => r !== null);
          
          if (parsed.length > 0) {
            this.savedReports = parsed as GarmentTestReport[];
            
            const defaultJob: FgdJobState = {
              id: 'job_saved_' + Date.now(),
              status: 'completed',
              startedAt: Date.now() - 60000,
              endedAt: Date.now(),
              elapsedSeconds: 201.7,
              currentGarmentIndex: this.savedReports.length - 1,
              totalGarments: this.savedReports.length,
              currentGarmentId: this.savedReports[0]?.garment_id || '',
              currentStepDescription: `Saved evaluation report (${this.savedReports.length} garment(s) evaluated)`,
              garmentIds: this.savedReports.map(r => r.garment_id),
              maxLoops: 2,
              logs: [],
              reports: this.savedReports
            };
            this.activeJob = defaultJob;
            this.jobHistory.push(defaultJob);
            return;
          }
        }
        
        // If DB has 0 rows, check disk fallback
        if (loadFromDiskFile()) {
          // Sync into database in background so DB has the records
          this.saveReportsToDisk(this.savedReports).catch(() => {});
        }
        return;
      } catch (err) {
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 1000));
        } else {
          loadFromDiskFile();
        }
      }
    }
  }

  public async saveReportsToDisk(reports: GarmentTestReport[]): Promise<void> {
    try {
      const newReports = [];
      for (const r of reports) {
        const anyR = r as any;
        if (!anyR.id) {
          anyR.id = `rep_${r.garment_id}_${new Date(r.tested_at || Date.now()).getTime()}`;
        }
        if (!anyR.run_label) {
          const dt = new Date(r.tested_at || Date.now());
          anyR.run_label = `Run on ${r.garment_id} (${dt.toLocaleDateString()} ${dt.toLocaleTimeString()})`;
        }
        const existingIdx = this.savedReports.findIndex(s => (s as any).id === anyR.id);
        if (existingIdx >= 0) {
          this.savedReports[existingIdx] = r;
        } else {
          this.savedReports.unshift(r);
        }
        
        newReports.push({
          id: anyR.id,
          status: 'completed',
          report_data: JSON.stringify(r),
          created_at: new Date()
        });
      }
      
      if (newReports.length > 0) {
        await db.insert(fgd_reports).values(newReports).onConflictDoUpdate({
          target: fgd_reports.id,
          set: {
            report_data: sql`excluded.report_data`,
            status: sql`excluded.status`
          }
        });
      }
    } catch (err) {
      console.error('[FgdJobManager] Failed to persist reports to postgres:', err);
    }
  }

  public async getSavedReports(forceReload: boolean = false): Promise<GarmentTestReport[]> {
    if (forceReload || this.savedReports.length === 0) {
      await this.loadSavedReportsFromDisk();
    }
    return this.savedReports;
  }

  /**
   * Wipes out pending (unapproved) candidate rules from the last round of evaluation
   * or across specified reports.
   * Ensures zero volatile state by persisting changes to PostgreSQL fgd_reports.
   */
  public async wipePendingRules(options?: {
    scope?: 'last_round' | 'all' | 'garment';
    garmentId?: string;
  }): Promise<{
    wipedCount: number;
    wipedRuleCodes: string[];
    affectedGarmentIds: string[];
    remainingPendingCount: number;
    updatedReports: GarmentTestReport[];
  }> {
    // 1. Get active rules from labeling_rules table to guarantee active rules are preserved
    const activeDbRules = await db.select()
      .from(labeling_rules)
      .where(eq(labeling_rules.is_active, true));

    const isApprovedRule = (r: RuleAmendment): boolean => {
      if ((r as any).is_approved === true) return true;
      return activeDbRules.some(dbR => 
        dbR.rule_code === r.rule_code && 
        dbR.target_field === r.target_field && (
          dbR.rule_title.trim().toLowerCase() === r.rule_title.trim().toLowerCase() ||
          dbR.rule_instruction.trim().slice(0, 30) === r.rule_instruction.trim().slice(0, 30)
        )
      );
    };

    if (this.savedReports.length === 0) {
      await this.loadSavedReportsFromDisk();
    }

    const scope = options?.scope || 'last_round';
    const targetGarmentId = options?.garmentId;

    let targetReports: GarmentTestReport[] = [];
    if (scope === 'garment' && targetGarmentId) {
      targetReports = this.savedReports.filter(r => r.garment_id === targetGarmentId);
    } else if (scope === 'all') {
      targetReports = [...this.savedReports];
    } else {
      // 'last_round': Determine the reports generated in the latest execution round
      if (this.activeJob?.reports && this.activeJob.reports.length > 0) {
        targetReports = this.activeJob.reports;
      } else if (this.savedReports.length > 0) {
        // Group by latest execution timestamp window (within 2 hours)
        const timestamps = this.savedReports.map(r => new Date(r.tested_at || 0).getTime()).filter(t => !isNaN(t) && t > 0);
        if (timestamps.length > 0) {
          const maxTime = Math.max(...timestamps);
          const windowMs = 2 * 60 * 60 * 1000;
          targetReports = this.savedReports.filter(r => {
            const t = new Date(r.tested_at || 0).getTime();
            return maxTime - t <= windowMs;
          });
        }
        if (targetReports.length === 0) {
          targetReports = [this.savedReports[0]];
        }
      }
    }

    let wipedCount = 0;
    const wipedRuleCodesSet = new Set<string>();
    const affectedGarmentIdsSet = new Set<string>();

    for (const report of targetReports) {
      let reportModified = false;
      if (report.loops && Array.isArray(report.loops)) {
        for (const loop of report.loops) {
          if (loop.amended_rules && Array.isArray(loop.amended_rules)) {
            const beforeLen = loop.amended_rules.length;
            const keptRules = loop.amended_rules.filter(r => {
              const isApproved = isApprovedRule(r);
              if (!isApproved) {
                wipedRuleCodesSet.add(r.rule_code);
              }
              return isApproved;
            });
            const diff = beforeLen - keptRules.length;
            if (diff > 0) {
              wipedCount += diff;
              loop.amended_rules = keptRules;
              reportModified = true;
              affectedGarmentIdsSet.add(report.garment_id);
            }
          }
        }
      }

      if (report.cumulative_rule_amendments && Array.isArray(report.cumulative_rule_amendments)) {
        report.cumulative_rule_amendments = report.cumulative_rule_amendments.filter(r => isApprovedRule(r));
      }

      // Update in savedReports
      const repIdx = this.savedReports.findIndex(s => 
        (s as any).id === (report as any).id || (s.garment_id === report.garment_id && s.tested_at === report.tested_at)
      );
      if (repIdx >= 0) {
        this.savedReports[repIdx] = report;
      }
    }

    // Also update activeJob if active
    if (this.activeJob?.reports) {
      for (const rep of this.activeJob.reports) {
        if (rep.loops) {
          for (const loop of rep.loops) {
            if (loop.amended_rules) {
              loop.amended_rules = loop.amended_rules.filter(r => isApprovedRule(r));
            }
          }
        }
        if (rep.cumulative_rule_amendments) {
          rep.cumulative_rule_amendments = rep.cumulative_rule_amendments.filter(r => isApprovedRule(r));
        }
      }
    }

    // Persist all modified reports to disk / postgres immediately
    await this.saveReportsToDisk(this.savedReports);

    // Calculate remaining pending count
    let remainingPendingCount = 0;
    for (const s of this.savedReports) {
      if (s.loops) {
        for (const loop of s.loops) {
          if (loop.amended_rules) {
            remainingPendingCount += loop.amended_rules.filter(r => !isApprovedRule(r)).length;
          }
        }
      }
    }

    return {
      wipedCount,
      wipedRuleCodes: Array.from(wipedRuleCodesSet),
      affectedGarmentIds: Array.from(affectedGarmentIdsSet),
      remainingPendingCount,
      updatedReports: this.savedReports
    };
  }

  public static getInstance(): FgdJobManager {
    if (!FgdJobManager.instance) {
      FgdJobManager.instance = new FgdJobManager();
    }
    return FgdJobManager.instance;
  }

  public getActiveJob(): FgdJobState | null {
    if (this.activeJob && this.activeJob.status === 'running') {
      this.activeJob.elapsedSeconds = Math.round(((Date.now() - this.activeJob.startedAt) / 1000) * 10) / 10;
    }
    return this.activeJob;
  }

  public getJob(jobId: string): FgdJobState | null {
    if (this.activeJob && this.activeJob.id === jobId) {
      return this.getActiveJob();
    }
    return this.jobHistory.find(j => j.id === jobId) || null;
  }

  public queueGarmentFgd(garmentId: string, maxLoops: number = 1): void {
    if (!garmentId) return;
    if (this.activeJob && this.activeJob.status === 'running') {
      if (!this.activeJob.garmentIds.includes(garmentId)) {
        this.activeJob.garmentIds.push(garmentId);
        this.activeJob.totalGarments = this.activeJob.garmentIds.length;
        this.addLog(
          this.activeJob,
          'INFO',
          `Garment ${garmentId} appended to active background FGD queue post-import.`,
          garmentId,
          'Auto-Queue'
        );
      }
      return;
    }
    try {
      this.startJob([garmentId], maxLoops);
    } catch (err: any) {
      console.warn(`[FgdJobManager] Could not auto-trigger FGD for newly imported garment ${garmentId}:`, err?.message);
    }
  }

  public cancelJob(jobId: string): boolean {
    if (this.activeJob && this.activeJob.id === jobId && this.activeJob.status === 'running') {
      this.abortRequested = true;
      this.activeJob.status = 'aborted';
      this.activeJob.endedAt = Date.now();
      this.activeJob.elapsedSeconds = Math.round(((Date.now() - this.activeJob.startedAt) / 1000) * 10) / 10;
      this.addLog(this.activeJob, 'WARN', 'Test suite aborted by user.');
      return true;
    }
    return false;
  }

  private addLog(job: FgdJobState, level: FgdJobLog['level'], message: string, garmentId?: string, step?: string) {
    const elapsedSec = Math.round(((Date.now() - job.startedAt) / 1000) * 10) / 10;
    const log: FgdJobLog = {
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec,
      level,
      message,
      garmentId,
      step
    };
    job.logs.push(log);
    if (job.logs.length > 300) {
      job.logs.shift();
    }
    console.log(`[FGD Background Job ${job.id}] [${level}] ${garmentId ? `(${garmentId}) ` : ''}${message}`);
  }

  public startJob(garmentIds: string[], maxLoops: number = 2, options?: { isReviewRun?: boolean }): FgdJobState {
    if (this.activeJob && this.activeJob.status === 'running') {
      throw new Error(`Another test suite job (${this.activeJob.id}) is currently in progress.`);
    }
    const isReviewRun = options?.isReviewRun === true;
    const effectiveLoops = isReviewRun ? 1 : maxLoops;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.abortRequested = false;
    const job: FgdJobState = {
      id: jobId,
      status: 'running',
      startedAt: Date.now(),
      elapsedSeconds: 0,
      currentGarmentIndex: 0,
      totalGarments: garmentIds.length,
      currentGarmentId: garmentIds[0] || '',
      currentStepDescription: isReviewRun 
        ? 'Starting fast 1-loop evaluation suite for garments under review...' 
        : 'Starting test sandbox worker thread...',
      garmentIds,
      maxLoops: effectiveLoops,
      isReviewRun,
      logs: [],
      reports: []
    };
    this.activeJob = job;
    this.addLog(
      job, 
      'INFO', 
      isReviewRun
        ? `Review evaluation suite started for ${garmentIds.length} garments under review (Strictly 1 loop, zero candidate rules, routing discrepancies to Jennifer & Jason)`
        : `Autonomous test suite started for ${garmentIds.length} garments (Max loops: ${effectiveLoops})`
    );
    
    this.runBackgroundExecution(job).catch(err => {
      console.error(`[FgdJobManager] Job ${job.id} unhandled error:`, err);
      job.status = 'failed';
      job.error = err?.message || String(err);
      job.endedAt = Date.now();
      job.elapsedSeconds = Math.round(((Date.now() - job.startedAt) / 1000) * 10) / 10;
      this.addLog(job, 'ERROR', `Job failed with fatal error: ${job.error}`);
    });
    return job;
  }

  private async runBackgroundExecution(job: FgdJobState): Promise<void> {
    let adaptiveCooldownMs = 600;
    for (let i = 0; i < job.garmentIds.length; i++) {
      if (this.abortRequested) {
        this.addLog(job, 'WARN', 'Execution cancelled during garment loop.');
        return;
      }
      const garmentId = job.garmentIds[i];
      job.currentGarmentIndex = i;
      job.currentGarmentId = garmentId;
      job.currentStepDescription = `Evaluating garment ${i + 1}/${job.totalGarments}: ${garmentId}`;
      const tGarmentStart = Date.now();
      this.addLog(job, 'STEP', `Beginning QA evaluation for ${garmentId} (Item ${i + 1}/${job.totalGarments})`, garmentId, 'Init');
      
      let success = false;
      for (let attempt = 1; attempt <= 2 && !success; attempt++) {
        try {
          const images = await this.fgdEngine.getGarmentImages(garmentId, false);
          this.addLog(
            job, 
            'INFO', 
            `Found ${images.length} archival photographic view(s): ${images.map(img => `${img.filename} (${img.role})`).join(', ') || 'None found'}`,
            garmentId,
            'Image Discovery'
          );
          
          this.addLog(job, 'STEP', `Executing chunked analytical pipeline...`, garmentId, 'Pipeline');
          const report = await this.fgdEngine.runGarmentTest(
            garmentId, 
            job.isReviewRun ? 1 : job.maxLoops, 
            (stepName, detail) => {
              this.addLog(job, 'INFO', `${stepName}: ${detail}`, garmentId, stepName);
            },
            { isReviewRun: job.isReviewRun }
          );
          job.reports.push(report);
          await this.saveReportsToDisk(job.reports);
          const garmentElapsed = Math.round(((Date.now() - tGarmentStart) / 1000) * 10) / 10;
          this.addLog(
            job, 
            'SUCCESS', 
            `Garment ${garmentId} evaluated in ${garmentElapsed}s. Score: ${report.final_score}/10.0 (${report.final_verdict}) - ${report.loops.length} loop(s)`,
            garmentId,
            'Done'
          );
          success = true;
          adaptiveCooldownMs = Math.max(600, adaptiveCooldownMs - 200);
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          const isQuota = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Quota') || errMsg.includes('exhausted');
          if (isQuota && attempt === 1) {
            adaptiveCooldownMs = Math.min(4500, adaptiveCooldownMs + 1500);
            this.addLog(job, 'WARN', `Gemini rate limit / quota exceeded for ${garmentId}. Dynamic throttle increased to ${adaptiveCooldownMs}ms. Retrying...`, garmentId, 'Rate Limit');
            await new Promise(r => setTimeout(r, adaptiveCooldownMs));
          } else {
            this.addLog(job, 'ERROR', `Failed testing garment ${garmentId}: ${errMsg}`, garmentId, 'Error');
            break;
          }
        }
      }
      if (i < job.garmentIds.length - 1) {
        await new Promise(r => setTimeout(r, adaptiveCooldownMs));
      }
    }
    job.status = 'completed';
    job.endedAt = Date.now();
    job.elapsedSeconds = Math.round(((Date.now() - job.startedAt) / 1000) * 10) / 10;
    job.currentStepDescription = `Test suite completed in ${job.elapsedSeconds}s (${job.reports.length}/${job.totalGarments} evaluated)`;
    this.addLog(job, 'SUCCESS', `Test suite completed in ${job.elapsedSeconds}s. Evaluated ${job.reports.length} garments.`);
    this.jobHistory.unshift({ ...job });
    if (this.jobHistory.length > 20) {
      this.jobHistory.pop();
    }
  }
}
