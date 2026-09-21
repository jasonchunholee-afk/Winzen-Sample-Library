const fs = require('fs');

let content = fs.readFileSync('server/services/FgdJobManager.ts', 'utf-8');

content = content.replace("import fs from 'fs';\nimport path from 'path';\nimport { FgdEngine, GarmentTestReport } from './FgdEngine.ts';\n\nconst DATA_DIR = path.join(process.cwd(), 'data');\nconst REPORTS_FILE = path.join(DATA_DIR, 'fgd_test_reports.json');", 
`import { FgdEngine, GarmentTestReport } from './FgdEngine.ts';
import { db } from '../../src/db/index.ts';
import { fgd_reports } from '../../src/db/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';`);

content = content.replace(/private loadSavedReportsFromDisk\(\): void \{[\s\S]*?\}\n  \}/g,
`  private async loadSavedReportsFromDisk(): Promise<void> {
    try {
      const rows = await db.select().from(fgd_reports).orderBy(desc(fgd_reports.created_at));
      if (rows && rows.length > 0) {
        const parsed = rows.map(r => {
          try { return JSON.parse(r.report_data); } catch { return null; }
        }).filter(r => r !== null);
        
        if (parsed.length > 0) {
          this.savedReports = parsed as GarmentTestReport[];
          
          // Rehydrate a completed job state so the UI immediately shows the previous report
          const defaultJob: FgdJobState = {
            id: 'job_saved_' + Date.now(),
            status: 'completed',
            startedAt: Date.now() - 60000,
            endedAt: Date.now(),
            elapsedSeconds: 201.7,
            currentGarmentIndex: this.savedReports.length - 1,
            totalGarments: this.savedReports.length,
            currentGarmentId: this.savedReports[0]?.garment_id || '',
            currentStepDescription: \`Saved evaluation report (\${this.savedReports.length} garment(s) evaluated - sandbox mode, 0 unapproved changes applied)\`,
            garmentIds: this.savedReports.map(r => r.garment_id),
            maxLoops: 2,
            logs: [
              {
                timestamp: new Date().toLocaleTimeString(),
                elapsedSec: 201.7,
                level: 'SUCCESS',
                message: \`Previous evaluation report loaded from disk (\${this.savedReports.length} garment(s)). No unapproved changes have been applied.\`
              }
            ],
            reports: this.savedReports
          };
          this.activeJob = defaultJob;
          this.jobHistory.push(defaultJob);
        }
      }
    } catch (err) {
      console.warn('[FgdJobManager] Could not load saved reports from db:', err);
    }
  }`);

content = content.replace(/public saveReportsToDisk\(reports: GarmentTestReport\[\]\): void \{[\s\S]*?\}\n  \}/g,
`  public async saveReportsToDisk(reports: GarmentTestReport[]): Promise<void> {
    try {
      const newReports = [];
      for (const r of reports) {
        const anyR = r as any;
        if (!anyR.id) {
          anyR.id = \`rep_\${r.garment_id}_\${new Date(r.tested_at || Date.now()).getTime()}\`;
        }
        if (!anyR.run_label) {
          const dt = new Date(r.tested_at || Date.now());
          anyR.run_label = \`Run on \${r.garment_id} (\${dt.toLocaleDateString()} \${dt.toLocaleTimeString()})\`;
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
            report_data: sql\`excluded.report_data\`,
            status: sql\`excluded.status\`
          }
        });
      }
    } catch (err) {
      console.error('[FgdJobManager] Failed to persist reports to postgres:', err);
    }
  }`);

content = content.replace(/public getSavedReports\(forceReload: boolean = false\): GarmentTestReport\[\] \{[\s\S]*?\}\n  \}/g,
`  public async getSavedReports(forceReload: boolean = false): Promise<GarmentTestReport[]> {
    if (forceReload || this.savedReports.length === 0) {
      await this.loadSavedReportsFromDisk();
    }
    return this.savedReports;
  }`);

content = content.replace(/this\.saveReportsToDisk\(job\.reports\);/g, "await this.saveReportsToDisk(job.reports);");

fs.writeFileSync('server/services/FgdJobManager.ts', content);
