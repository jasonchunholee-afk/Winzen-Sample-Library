import fs from 'fs';

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Ensure `invisible_hashtags: g.invisible_hashtags || '',` is in the update statement
if (!serverCode.includes('invisible_hashtags: g.invisible_hashtags')) {
  serverCode = serverCode.replace(
    'hashtags: g.hashtags || \'\',',
    'hashtags: g.hashtags || \'\',\n        invisible_hashtags: g.invisible_hashtags || \'\','
  );
  fs.writeFileSync('server.ts', serverCode);
  console.log("Added invisible_hashtags to db.update(garments) in server.ts");
} else {
  console.log("invisible_hashtags already in db.update");
}
