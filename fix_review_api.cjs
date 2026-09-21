const fs = require('fs');

let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

review = review.replace(
  "fetch('/garments_data.json')",
  "fetch('/api/garments')"
);

fs.writeFileSync('src/components/Review.tsx', review);
