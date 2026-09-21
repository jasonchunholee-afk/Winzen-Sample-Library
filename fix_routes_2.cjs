const fs = require('fs');

let content = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');

// Fix un-awaited buildCabinet calls causing length errors
content = content.replace(/const locations = warehouseFacade\.buildCabinet\(/g, 'const locations = await warehouseFacade.buildCabinet(');

fs.writeFileSync('server/warehouse/routes.ts', content);
