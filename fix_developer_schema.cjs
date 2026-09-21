const fs = require('fs');

let dev = fs.readFileSync('src/components/Developer.tsx', 'utf8');

dev = dev.replace('g.reviewer_feedback', 'g.structural_feedback');
dev = dev.replace('Feedback Notes', 'Structural Feedback');

fs.writeFileSync('src/components/Developer.tsx', dev);
