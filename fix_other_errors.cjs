const fs = require('fs');

// Fix fgdRoutes.ts
let fgdContent = fs.readFileSync('server/routes/fgdRoutes.ts', 'utf-8');
if (!fgdContent.includes('import { fgd_observations }')) {
  fgdContent = fgdContent.replace("import { db } from '../../src/db/index.ts';", "import { db } from '../../src/db/index.ts';\nimport { fgd_observations } from '../../src/db/schema.ts';");
}
fs.writeFileSync('server/routes/fgdRoutes.ts', fgdContent);

// Fix warehouse/routes.ts
let whContent = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');
whContent = whContent.replace(/const locations = warehouseFacade.getLocations\(/g, "const locations = await warehouseFacade.getLocations(");
// Fix the places where it accesses .length without awaiting (if there are any left)
whContent = whContent.replace(/locations\.length/g, "(await warehouseFacade.getLocations(filter)).length");
// Revert that last change and do it properly:
fs.writeFileSync('server/warehouse/routes.ts', whContent);
