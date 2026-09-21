const fs = require('fs');
let content = fs.readFileSync('server/services/FgdJobManager.ts', 'utf-8');

content = content.replace(/public async getSavedReports\(forceReload: boolean = false\): Promise<GarmentTestReport\[\]> \{[\s\S]*?\}\n  \}/g,
`public async getSavedReports(forceReload: boolean = false): Promise<GarmentTestReport[]> {
    if (forceReload || this.savedReports.length === 0) {
      await this.loadSavedReportsFromDisk();
    }
    return this.savedReports;
  }

  public static getInstance(): FgdJobManager {
    if (!FgdJobManager.instance) {
      FgdJobManager.instance = new FgdJobManager();
    }
    return FgdJobManager.instance;
  }`);

fs.writeFileSync('server/services/FgdJobManager.ts', content);
