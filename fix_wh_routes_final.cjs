const fs = require('fs');

let content = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');

// Fix the bulk area handler to be async
content = content.replace("router.post('/builder/init-bulk-area', (req, res) => {", "router.post('/builder/init-bulk-area', async (req, res) => {");

// Fix the length bugs
content = content.replace(/\(await warehouseFacade\.getLocations\(filter\)\)\.length/g, "locations.length");

fs.writeFileSync('server/warehouse/routes.ts', content);
