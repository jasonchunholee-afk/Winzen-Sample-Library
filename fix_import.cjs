const fs = require('fs');

let content = fs.readFileSync('server/routes/fgdRoutes.ts', 'utf-8');
content = content.replace("import { labeling_rules, garments, images } from \"../../src/db/schema.ts\";", "import { labeling_rules, garments, images, fgd_observations } from \"../../src/db/schema.ts\";");
fs.writeFileSync('server/routes/fgdRoutes.ts', content);
