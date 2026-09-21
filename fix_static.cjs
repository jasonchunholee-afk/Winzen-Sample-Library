const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

if (!server.includes('app.use(express.static(path.join(process.cwd(), "public")));')) {
  server = server.replace(
    'if (process.env.NODE_ENV !== "production") {',
    '// Serve public files via Express dynamically instead of waiting for Vite to watch them\n  app.use(express.static(path.join(process.cwd(), "public")));\n\n  if (process.env.NODE_ENV !== "production") {'
  );
  fs.writeFileSync('server.ts', server);
}
