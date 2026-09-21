const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

review = review.replace(
  /brand: aiData\.brand \|\| mock\.brand,[\s\S]*?materials: aiData\.materials \|\| \[\]/,
  "...aiData"
);

fs.writeFileSync('src/components/Review.tsx', review);
