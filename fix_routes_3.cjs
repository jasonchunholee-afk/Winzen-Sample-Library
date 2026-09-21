const fs = require('fs');

let content = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');

// Fix un-awaited getLocations calls causing length and slice errors
// Find instances like "locations.length" and ensure locations is awaited before accessing properties
content = content.replace(/const locations = warehouseFacade\.getLocations\(/g, 'const locations = await warehouseFacade.getLocations(');

fs.writeFileSync('server/warehouse/routes.ts', content);
