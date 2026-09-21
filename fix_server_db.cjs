const fs = require('fs');

const serverCode = `import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import multer from "multer";
import sharp from "sharp";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- SQLITE DB INIT ---
  const dbPath = path.join(process.cwd(), "public", "library.db");
  const db = new DatabaseSync(dbPath);
  
  db.exec(\`
    CREATE TABLE IF NOT EXISTS garments (
      id TEXT PRIMARY KEY,
      brand TEXT,
      buyer TEXT,
      season TEXT,
      sales TEXT,
      cust_style_no TEXT,
      y_style_no TEXT,
      garment_type TEXT,
      washing TEXT,
      fabric_raw TEXT,
      gnw_weight TEXT,
      gnw_is_ai_estimated INTEGER,
      fabric_yarn_count TEXT,
      fabric_material TEXT,
      fabric_construction TEXT,
      sample_job_no TEXT,
      color TEXT,
      color_is_ai_estimated INTEGER,
      size TEXT,
      print_datetime TEXT,
      description TEXT,
      remark_memo TEXT,
      location TEXT,
      status TEXT,
      reviewer_feedback TEXT,
      default_front_image_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garment_id TEXT,
      role TEXT,
      filename TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (garment_id) REFERENCES garments(id)
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garment_id TEXT,
      summary_text TEXT,
      rating INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (garment_id) REFERENCES garments(id)
    );
  \`);

  // --- SEED DATABASE IF EMPTY ---
  const seedCheck = db.prepare('SELECT COUNT(*) as count FROM garments').get();
  if (seedCheck.count === 0 && fs.existsSync(path.join(process.cwd(), 'public', 'garments_data.json'))) {
    const rawData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'garments_data.json'), 'utf8'));
    const insertGarment = db.prepare(\`
      INSERT INTO garments (id, brand, buyer, season, sales, cust_style_no, y_style_no, garment_type, washing, fabric_raw, gnw_weight, gnw_is_ai_estimated, fabric_yarn_count, fabric_material, fabric_construction, sample_job_no, color, color_is_ai_estimated, size, print_datetime, description, remark_memo, location, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`);
    const insertSummary = db.prepare(\`INSERT INTO summaries (garment_id, summary_text) VALUES (?, ?)\`);
    
    for (const g of rawData) {
      insertGarment.run(
        g.id, g.brand || '', g.buyer || '', g.season || '', g.sales || '', g.cust_style_no || '', 
        g.y_style_no || '', g.garment_type || '', g.washing || '', g.fabric_raw || '', 
        g.gnw_weight || '', g.gnw_is_ai_estimated ? 1 : 0, g.fabric_yarn_count || '', 
        g.fabric_material || '', g.fabric_construction || '', g.sample_job_no || '', 
        g.color || '', g.color_is_ai_estimated ? 1 : 0, g.size || '', g.print_datetime || '', 
        g.description || '', g.remark_memo || '', 'Vault — 0001', 'pending'
      );
      if (g.jennifer_emulator_raw) {
        insertSummary.run(g.id, g.jennifer_emulator_raw);
      }
    }
  }

  // --- API ENDPOINTS ---
  app.get("/api/garments", (req, res) => {
    const garments = db.prepare('SELECT * FROM garments').all();
    const images = db.prepare('SELECT * FROM images').all();
    const summaries = db.prepare('SELECT * FROM summaries ORDER BY created_at DESC').all();

    const formatted = garments.map(g => {
      const gImages = images.filter(img => img.garment_id === g.id).map(img => ({
        id: img.id,
        role: img.role,
        url: \`/images_thumb/\${img.filename}\`,
        fullUrl: \`/images_ai/\${img.filename}\`,
        fallbackUrl: \`/images/\${img.filename}\`
      }));

      // If there are no images in the DB yet (legacy json migration), inject the legacy ones temporarily
      if (gImages.length === 0) {
        gImages.push(
          { role: 'Front', url: \`/images_thumb/\${g.id} (F).jpg\`, fullUrl: \`/images_ai/\${g.id} (F).jpg\`, fallbackUrl: \`/images/\${g.id} (F).jpg\` },
          { role: 'Back', url: \`/images_thumb/\${g.id} (B).jpg\`, fullUrl: \`/images_ai/\${g.id} (B).jpg\`, fallbackUrl: \`/images/\${g.id} (B).jpg\` },
          { role: 'Label', url: \`/images_thumb/\${g.id}.jpg\`, fullUrl: \`/images_ai/\${g.id}.jpg\`, fallbackUrl: \`/images/\${g.id}.jpg\` }
        );
      }

      const gSummaries = summaries.filter(s => s.garment_id === g.id);

      return {
        ...g,
        images: gImages,
        summaries: gSummaries,
        gnw_is_ai_estimated: g.gnw_is_ai_estimated === 1,
        color_is_ai_estimated: g.color_is_ai_estimated === 1,
        jennifer_emulator_raw: gSummaries.length > 0 ? gSummaries[0].summary_text : ''
      };
    });

    res.json(formatted);
  });

  app.post("/api/garments/:id/feedback", (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    db.prepare('UPDATE garments SET reviewer_feedback = ? WHERE id = ?').run(feedback, id);
    res.json({ success: true });
  });

  app.post("/api/summaries/:summaryId/rate", (req, res) => {
    const { summaryId } = req.params;
    const { rating } = req.body;
    db.prepare('UPDATE summaries SET rating = ? WHERE id = ?').run(rating, summaryId);
    res.json({ success: true });
  });

  // --- UPLOAD & COMPRESS PIPELINE ---
  const publicDir = path.join(process.cwd(), "public");
  const imagesDir = path.join(publicDir, "images");
  const thumbDir = path.join(publicDir, "images_thumb");
  const aiDir = path.join(publicDir, "images_ai");
  
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
  if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir, { recursive: true });

  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      
      const garmentId = req.body.garmentId || 'UNKNOWN';
      const role = req.body.role || 'Front';

      const filename = req.file.originalname;
      const parsed = path.parse(filename);
      let saveFilename = filename;
      if (fs.existsSync(path.join(imagesDir, saveFilename))) {
        saveFilename = \`\${parsed.name}_\${Date.now()}\${parsed.ext}\`;
      }
      
      const rawPath = path.join(imagesDir, saveFilename);
      const thumbPath = path.join(thumbDir, saveFilename);
      const aiPath = path.join(aiDir, saveFilename);

      // Save images
      fs.writeFileSync(rawPath, req.file.buffer);
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toFile(thumbPath);
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(aiPath);

      // Insert into DB
      const checkGarment = db.prepare('SELECT id FROM garments WHERE id = ?').get(garmentId);
      if (!checkGarment) {
        db.prepare('INSERT INTO garments (id, status) VALUES (?, ?)').run(garmentId, 'pending');
      }
      db.prepare('INSERT INTO images (garment_id, role, filename) VALUES (?, ?, ?)').run(garmentId, role, saveFilename);

      res.json({ success: true, filename: saveFilename });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Vite middleware for development
  app.use(express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

startServer();
`;

fs.writeFileSync('server.ts', serverCode);
