const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const tableCreation = `    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garment_id TEXT,
      summary_text TEXT,
      rating INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (garment_id) REFERENCES garments(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL
    );
`;
serverCode = serverCode.replace(/CREATE TABLE IF NOT EXISTS summaries \([\s\S]*?\);/, tableCreation);

const seedCheck = `  // --- SEED DATABASE IF EMPTY ---
  db.prepare("INSERT OR IGNORE INTO users (username, password) VALUES ('Jason', 'Jason')").run();

  const seedCheck =`;
serverCode = serverCode.replace("  // --- SEED DATABASE IF EMPTY ---\n  const seedCheck =", seedCheck);

const authEndpoints = `  // --- AUTH ENDPOINTS ---
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    
    if (user && user.password.toLowerCase() === password.toLowerCase()) {
      res.json({ success: true, username: user.username });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/change-password", (req, res) => {
    const { username, newPassword } = req.body;
    db.prepare('UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)').run(newPassword, username);
    res.json({ success: true });
  });

  // --- API ENDPOINTS ---`;
serverCode = serverCode.replace("  // --- API ENDPOINTS ---", authEndpoints);

fs.writeFileSync('server.ts', serverCode);
