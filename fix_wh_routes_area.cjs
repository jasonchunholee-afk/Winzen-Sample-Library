const fs = require('fs');
let content = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');
content = content.replace(/const locations = warehouseFacade.buildArea\(/g, "const locations = await warehouseFacade.buildArea(");
fs.writeFileSync('server/warehouse/routes.ts', content);
