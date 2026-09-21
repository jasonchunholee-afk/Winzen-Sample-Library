import fs from 'fs';

let schema = fs.readFileSync('src/db/schema.ts', 'utf8');
if (!schema.includes('field_changes: text')) {
  schema = schema.replace(
    "status: text('status').default('pending'),",
    "field_changes: text('field_changes'),\n  applied_at: timestamp('applied_at'),\n  status: text('status').default('pending'),"
  );
  fs.writeFileSync('src/db/schema.ts', schema);
  console.log("Updated schema.ts with field_changes and applied_at");
} else {
  console.log("Already updated");
}
