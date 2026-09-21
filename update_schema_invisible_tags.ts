import fs from 'fs';

let schema = fs.readFileSync('src/db/schema.ts', 'utf8');
if (!schema.includes('invisible_hashtags')) {
  schema = schema.replace(
    "hashtags: text('hashtags'),",
    "hashtags: text('hashtags'),\n  invisible_hashtags: text('invisible_hashtags'),"
  );
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log("Updated src/db/schema.ts with invisible_hashtags");
} else {
  console.log("invisible_hashtags already in schema");
}
