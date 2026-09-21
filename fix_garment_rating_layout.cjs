const fs = require('fs');

let code = fs.readFileSync('src/components/GarmentDetail.tsx', 'utf8');
// check if rating works
if (!code.includes('saveRating(')) {
  console.log("Error: rating save not found");
}

