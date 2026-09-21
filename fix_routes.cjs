const fs = require('fs');

let content = fs.readFileSync('server/warehouse/routes.ts', 'utf-8');

// Replace standard synchronous facade calls with await
content = content.replace(/const locations = warehouseFacade.getLocations\(/g, 'const locations = await warehouseFacade.getLocations(');
content = content.replace(/const locations = warehouseFacade.buildCabinet\(/g, 'const locations = await warehouseFacade.buildCabinet(');
content = content.replace(/const locs = warehouseFacade.buildArea\(/g, 'const locs = await warehouseFacade.buildArea(');
content = content.replace(/const result = warehouseFacade.toggleStack5\(/g, 'const result = await warehouseFacade.toggleStack5(');
content = content.replace(/const assignment = warehouseFacade.assignSpace\(/g, 'const assignment = await warehouseFacade.assignSpace(');
content = content.replace(/const result = warehouseFacade.shelveBatch\(/g, 'const result = await warehouseFacade.shelveBatch(');
content = content.replace(/const batches = warehouseFacade.getBatches\(/g, 'const batches = await warehouseFacade.getBatches(');
content = content.replace(/const updated = locationDao.updateByCode\(/g, 'const updated = await locationDao.updateByCode(');

// In router.post('/assign-manual')
content = content.replace(/const loc = locationDao.findByCode\(/g, 'const loc = await locationDao.findByCode(');
content = content.replace(/locationDao.incrementGarmentCount\(/g, 'await locationDao.incrementGarmentCount(');

// Make routes async where needed
content = content.replace(/router.get\('\/locations', \(req, res\) => {/g, "router.get('/locations', async (req, res) => {");
content = content.replace(/router.post\('\/builder\/cabinet', \(req, res\) => {/g, "router.post('/builder/cabinet', async (req, res) => {");
content = content.replace(/router.post\('\/builder\/area', \(req, res\) => {/g, "router.post('/builder/area', async (req, res) => {");
content = content.replace(/router.post\('\/builder\/init-all', \(req, res\) => {/g, "router.post('/builder/init-all', async (req, res) => {");
content = content.replace(/router.post\('\/builder\/toggle-stack5', \(req, res\) => {/g, "router.post('/builder/toggle-stack5', async (req, res) => {");
content = content.replace(/router.post\('\/assign-next', \(req, res\) => {/g, "router.post('/assign-next', async (req, res) => {");
content = content.replace(/router.post\('\/shelve-batch', \(req, res\) => {/g, "router.post('/shelve-batch', async (req, res) => {");
content = content.replace(/router.get\('\/batches', \(req, res\) => {/g, "router.get('/batches', async (req, res) => {");
content = content.replace(/router.put\('\/locations\/:code\/mode', \(req, res\) => {/g, "router.put('/locations/:code/mode', async (req, res) => {");

fs.writeFileSync('server/warehouse/routes.ts', content);
