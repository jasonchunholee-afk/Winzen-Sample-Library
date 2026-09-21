const fs = require('fs');

const code = `import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import sharp from "sharp";
import { db } from "./src/db/index.ts";
import { users, garments, images, summaries } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // --- SEED DATABASE IF EMPTY ---
  try {
    await db.insert(users).values({ uid: 'jason', email: 'jason@example.com' }).onConflictDoNothing();
    await db.insert(users).values({ uid: 'jennifer', email: 'jennifer@example.com' }).onConflictDoNothing();
  } catch (e) {
    console.error("Seed error", e);
  }

  // --- API ENDPOINTS ---
  app.post("/api/auth/login", async (req, res) => {
    // Basic mock login for now to keep it working
    const { username, password } = req.body;
    if ((username.toLowerCase() === 'jason' && password.toLowerCase() === 'jason') || 
        (username.toLowerCase() === 'jennifer' && password.toLowerCase() === 'jennifer')) {
      res.json({ success: true, username: username });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/garments/:id/approve", async (req, res) => {
    const { id } = req.params;
    try {
      await db.update(garments).set({ status: 'Approved' }).where(eq(garments.id, id));
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/garments", async (req, res) => {
    try {
      const allGarments = await db.select().from(garments);
      const allImages = await db.select().from(images);
      const allSummaries = await db.select().from(summaries).orderBy(desc(summaries.created_at));
      
      const formatted = allGarments.map(g => {
        const gImages = allImages.filter(img => img.garment_id === g.id).map(img => ({
          id: img.id,
          role: img.role,
          url: \`/images_thumb/\${img.filename}\`,
          fullUrl: \`/images_ai/\${img.filename}\`,
          fallbackUrl: \`/images/\${img.filename}\`
        }));
        
        if (gImages.length === 0) {
          gImages.push(
            { id: 1, role: 'Front', url: \`/images_thumb/\${g.id} (F).jpg\`, fullUrl: \`/images_ai/\${g.id} (F).jpg\`, fallbackUrl: \`/images/\${g.id} (F).jpg\` },
            { id: 2, role: 'Back', url: \`/images_thumb/\${g.id} (B).jpg\`, fullUrl: \`/images_ai/\${g.id} (B).jpg\`, fallbackUrl: \`/images/\${g.id} (B).jpg\` },
            { id: 3, role: 'Label', url: \`/images_thumb/\${g.id}.jpg\`, fullUrl: \`/images_ai/\${g.id}.jpg\`, fallbackUrl: \`/images/\${g.id}.jpg\` }
          );
        }
        
        const gSummaries = allSummaries.filter(s => s.garment_id === g.id);
        
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
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/garments/:id", async (req, res) => {
    const { id } = req.params;
    const g = req.body;
    try {
      await db.update(garments).set({
        buyer: g.buyer || '', season: g.season || '', sales: g.sales || '', cust_style_no: g.cust_style_no || '',
        y_style_no: g.y_style_no || '', garment_type: g.garment_type || '', washing: g.washing || '', fabric_raw: g.fabric_raw || '',
        gnw_weight: g.gnw_weight || '', fabric_yarn_count: g.fabric_yarn_count || '', fabric_material: g.fabric_material || '',
        fabric_construction: g.fabric_construction || '', sample_job_no: g.sample_job_no || '', color: g.color || '',
        size: g.size || '', print_datetime: g.print_datetime || '', description: g.description || '', remark_memo: g.remark_memo || '',
        structural_feedback: g.structural_feedback || '', content_notes: g.content_notes || '', hashtags: g.hashtags || ''
      }).where(eq(garments.id, id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/garments/:id/feedback", async (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    try {
      await db.update(garments).set({ reviewer_feedback: feedback }).where(eq(garments.id, id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/summaries/:summaryId/rate", async (req, res) => {
    const { summaryId } = req.params;
    const { rating } = req.body;
    try {
      await db.update(summaries).set({ rating }).where(eq(summaries.id, parseInt(summaryId)));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- UPLOAD ---
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
      fs.writeFileSync(rawPath, req.file.buffer);
      await sharp(req.file.buffer).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, progressive: true }).toFile(thumbPath);
      await sharp(req.file.buffer).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, progressive: true }).toFile(aiPath);
      
      const existing = await db.select().from(garments).where(eq(garments.id, garmentId));
      if (existing.length === 0) {
        await db.insert(garments).values({ id: garmentId, status: 'pending' });
      }
      await db.insert(images).values({ garment_id: garmentId, role, filename: saveFilename });
      
      res.json({ success: true, filename: saveFilename });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Vite middleware
  app.use(express.static(path.join(process.cwd(), "public")));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }
  
  app.listen(PORT, "0.0.0.0", () => { console.log(\`Server running on port \${PORT}\`); });
}
startServer();
`;

fs.writeFileSync('server.ts', code);
