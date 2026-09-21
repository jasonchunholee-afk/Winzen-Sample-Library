const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// Fix un-awaited assignSpace calls in server.ts
content = content.replace(/const assignment = warehouseFacade\.assignSpace\(\{/g, 'const assignment = await warehouseFacade.assignSpace({');

fs.writeFileSync('server.ts', content);
