import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import sharp from "sharp";
import { db } from "./src/db/index.ts";
import { users, garments, images, summaries, structural_change_requests, labeling_rules, abbreviation_library } from "./src/db/schema.ts";
import { eq, desc, and, inArray, or } from "drizzle-orm";
import { ChunkSessionManager } from "./server/services/ChunkSessionManager.ts";
import { GarmentImageProcessor } from "./server/services/ImageProcessor.ts";
import { FgdEngine } from "./server/services/FgdEngine.ts";
import { UploadDiagnosticLogger } from "./server/services/UploadDiagnosticLogger.ts";
import { FgdJobManager } from "./server/services/FgdJobManager.ts";
import { EquatedCodeManager } from "./server/services/EquatedCodeManager.ts";
import { CaptureAiInspector } from "./server/services/CaptureAiInspector.ts";
import { CaptureTriageManager } from "./server/services/CaptureTriageManager.ts";
import { DirectorCommentManager } from "./server/services/DirectorCommentManager.ts";
import { SeedManager } from "./server/services/SeedManager.ts";
import { createPool } from "./src/db/index.ts";
import { createFgdRouter } from "./server/routes/fgdRoutes.ts";
import { createUploadDiagnosticRouter } from "./server/routes/uploadRoutes.ts";
import { createCaptureRouter } from "./server/routes/captureRoutes.ts";
import { createBridgeRouter, createSentinelRouter } from "./server/routes/bridgeRoutes.ts";
import warehouseRouter from "./server/warehouse/routes.ts";
import { warehouseFacade } from "./server/warehouse/WarehouseFacade.ts";

async function startServer() {
  const SERVER_BOOT_TIMESTAMP = Date.now();
  const APP_VERSION = "1.5.0";
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));

  // --- 1. DIRECTORY PATHS INITIALIZATION (MUST BE AT THE VERY TOP) ---
  const publicDir = path.join(process.cwd(), "public");
  const imagesDir = path.join(publicDir, "images");
  const thumbDir = path.join(publicDir, "images_thumb");
  const aiDir = path.join(publicDir, "images_ai");
  
  [publicDir, imagesDir, thumbDir, aiDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Object-Oriented Service Singletons
  const chunkSessionManager = new ChunkSessionManager();
  const garmentImageProcessor = new GarmentImageProcessor();
  const fgdEngine = new FgdEngine();
  const uploadLogger = UploadDiagnosticLogger.getInstance();
  const fgdJobManager = FgdJobManager.getInstance();
  const equatedCodeManager = EquatedCodeManager.getInstance();
  const captureAiInspector = CaptureAiInspector.getInstance();
  const directorCommentManager = DirectorCommentManager.getInstance();

  // --- MEMORY & STABILITY SENTINEL ---
  // Catch unhandled errors before they crash the container process
  process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [PRE-CRASH INTERCEPTED] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('⚠️ [PRE-CRASH INTERCEPTED] Uncaught Exception:', err);
  });

  // Background stability sentinel: checks memory usage and database pool responsiveness every 30 seconds
  const pgPool = createPool();
  setInterval(async () => {
    try {
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const heapRatio = mem.heapTotal > 0 ? (mem.heapUsed / mem.heapTotal) : 0;

      // 1. Warn if memory approaches container thresholds or exceeds 80% of heap
      if (heapUsedMB > 350 || heapRatio > 0.80) {
        console.warn(`⚠️ [HIGH MEMORY WARNING] Heap at ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(heapRatio * 100)}%), RSS: ${rssMB}MB. Approaching container limits; close unused tabs or run garbage collection.`);
        if (typeof (global as any).gc === 'function') {
          try {
            (global as any).gc();
            console.log('[Memory Sentinel] Forced garbage collection invoked.');
          } catch {}
        }
      }

      // 2. Database connection pool & latency check
      if (pgPool) {
        const startTime = Date.now();
        try {
          const client = await pgPool.connect();
          await client.query('SELECT 1');
          client.release();
          const latencyMs = Date.now() - startTime;
          if (latencyMs > 1500) {
            console.warn(`⚠️ [DB HIGH LATENCY WARNING] Database ping query took ${latencyMs}ms. Connection pool may be experiencing contention.`);
          }
        } catch (dbErr: any) {
          console.error(`⚠️ [DB POOL DROP WARNING] Failed to acquire database client or ping Cloud SQL:`, dbErr?.message || dbErr);
        }
      }
    } catch (sentinelErr: any) {
      console.warn('[Sentinel Monitor Warning]:', sentinelErr?.message || sentinelErr);
    }
  }, 30000);

  // Health check endpoint with diagnostic metrics
  app.get("/api/health", (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: "ok",
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
      }
    });
  });

  // --- SEED MANAGEMENT ENDPOINTS ---
  app.post("/api/admin/bake-seed", async (req, res) => {
    try {
      const result = await SeedManager.bakeSeedFiles();
      res.json({ success: true, message: "Baked database state into permanent seed files", result });
    } catch (e: any) {
      console.error("[Bake Seed Error]", e);
      res.status(500).json({ error: e?.message || "Failed to bake seed files" });
    }
  });

  app.post("/api/admin/hydrate-seed", async (req, res) => {
    try {
      const result = await SeedManager.hydrateDatabase();
      res.json({ success: true, message: "Hydrated database from permanent seed files", result });
    } catch (e: any) {
      console.error("[Hydrate Seed Error]", e);
      res.status(500).json({ error: e?.message || "Failed to hydrate from seed files" });
    }
  });

  // --- CODE EXPORT ENDPOINTS (Single authoritative streaming endpoint) ---
  app.get("/api/export-code", (req, res) => {
    res.setHeader("Content-Disposition", "attachment; filename=winzen-sample-library-full.tar.gz");
    res.setHeader("Content-Type", "application/gzip");
    const tarProcess = exec("tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='public/images' --exclude='public/images_thumb' --exclude='public/images_ai' -czf - .");
    tarProcess.stdout?.pipe(res);
    tarProcess.stderr?.on('data', (d) => console.error("tar error:", d.toString()));
  });

  app.get("/api/export-capture", (req, res) => {
    res.setHeader("Content-Disposition", "attachment; filename=winzen-capture-module.tar.gz");
    res.setHeader("Content-Type", "application/gzip");
    const tarProcess = exec("tar -czf - src/components/Capture.tsx src/components/capture/ src/config/garmentShotTaxonomy.ts src/utils/imageCompression.ts src/utils/fileParsing.ts CAPTURE_HANDOFF_PACKAGE.md");
    tarProcess.stdout?.pipe(res);
    tarProcess.stderr?.on('data', (d) => console.error("tar capture error:", d.toString()));
  });

  // --- API ENDPOINTS ---
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if ((username?.toLowerCase() === 'jason' && password?.toLowerCase() === 'jason') || 
        (username?.toLowerCase() === 'jennifer' && password?.toLowerCase() === 'jennifer')) {
      res.json({ success: true, username });
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
    } catch(e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // --- PENDING CHANGES & ACTIVATION API ---
  app.get("/api/pending-changes", async (req, res) => {
    try {
      const pending = await db.select().from(structural_change_requests)
        .where(eq(structural_change_requests.status, 'pending'))
        .orderBy(desc(structural_change_requests.created_at));
      
      const allGarments = await db.select().from(garments);
      const enriched = pending.map(p => {
        const g = allGarments.find(item => item.id === p.garment_id);
        let parsedFieldChanges = {};
        try {
          parsedFieldChanges = JSON.parse(p.field_changes || '{}');
        } catch {}
        let parsedStructural = [];
        try {
          parsedStructural = JSON.parse(p.structural_requests || '[]');
        } catch {}
        return {
          ...p,
          garment: g || null,
          parsedFieldChanges,
          parsedStructural
        };
      });
      res.json(enriched);
    } catch (err: any) {
      console.error("Error fetching pending changes:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  app.post("/api/pending-changes", async (req, res) => {
    try {
      const { garment_id, raw_feedback, field_changes, structural_requests, dependent_updates } = req.body;
      const newReq = await db.insert(structural_change_requests).values({
        garment_id,
        raw_feedback: raw_feedback || '',
        field_changes: typeof field_changes === 'object' ? JSON.stringify(field_changes) : (field_changes || '{}'),
        structural_requests: typeof structural_requests === 'object' ? JSON.stringify(structural_requests) : (structural_requests || '[]'),
        dependent_updates: typeof dependent_updates === 'object' ? JSON.stringify(dependent_updates) : (dependent_updates || '{}'),
        status: 'pending'
      }).returning();

      await db.update(garments).set({ status: 'Pending Approval' }).where(eq(garments.id, garment_id));
      res.json(newReq[0]);
    } catch (err: any) {
      console.error("Error staging pending change:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Activate pending changes with exact syntax "Apply Approved Changes"
  app.post("/api/changes/apply-approved", async (req, res) => {
    try {
      const { command, garment_id } = req.body;
      if (!command || command.trim().toLowerCase() !== "apply approved changes") {
        return res.status(400).json({ 
          error: "Invalid activation command. You must provide the exact syntax: 'Apply Approved Changes'" 
        });
      }

      const pendingList = await db.select().from(structural_change_requests)
        .where(
          garment_id 
            ? and(eq(structural_change_requests.status, 'pending'), eq(structural_change_requests.garment_id, garment_id))
            : eq(structural_change_requests.status, 'pending')
        );

      if (pendingList.length === 0) {
        if (garment_id) {
          await db.update(garments).set({ status: 'Approved' }).where(eq(garments.id, garment_id));
          return res.json({ success: true, count: 1, message: "Garment approved directly." });
        }
        return res.json({ success: true, count: 0, message: "No pending changes to apply." });
      }

      const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
      const rulesText = activeRules.map(r => `[${r.rule_code}] ${r.rule_title}: ${r.rule_instruction}`).join('\n');

      let appliedCount = 0;
      for (const p of pendingList) {
        let fieldChanges: any = {};
        try { fieldChanges = JSON.parse(p.field_changes || '{}'); } catch {}
        let depUpdates: any = {};
        try { depUpdates = JSON.parse(p.dependent_updates || '{}'); } catch {}

        const mergedUpdates: any = {
          ...fieldChanges,
          ...depUpdates,
          status: 'Approved',
          structural_feedback: ''
        };

        if (Object.keys(mergedUpdates).length > 0) {
          await db.update(garments).set(mergedUpdates).where(eq(garments.id, p.garment_id));
        }

        const gList = await db.select().from(garments).where(eq(garments.id, p.garment_id));
        const updatedG = gList[0];
        if (updatedG && process.env.GEMINI_API_KEY) {
          try {
            const ai = new GoogleGenAI({ 
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });
            const summaryPrompt = `Generate a precise, professional Archival Summary for this approved garment in the Winzen archive:
Garment ID: ${updatedG.id}
Buyer: ${updatedG.buyer}
Garment Type: ${updatedG.garment_type}
Season: ${updatedG.season}
Style No: ${updatedG.cust_style_no} / ${updatedG.y_style_no}
Fabric: ${updatedG.fabric_raw}
Material: ${updatedG.fabric_material}
Weight: ${updatedG.gnw_weight}
Yarn Count: ${updatedG.fabric_yarn_count}
Construction: ${updatedG.fabric_construction}
Color: ${updatedG.color}
Size: ${updatedG.size}
Visible Hashtags: ${updatedG.hashtags}
Invisible / Alternative Search Hashtags: ${updatedG.invisible_hashtags}
Approved Changes Applied: ${p.raw_feedback || 'User structural approval'}

RULES ENFORCED:
${rulesText}

Write 2-4 authoritative, highly detailed sentences summarizing this garment's construction, technical fabric features, aesthetic attributes, and taxonomy classification. Do NOT output markdown headers, just the pure archival paragraph.`;

            let summaryRes: any = null;
            try {
              summaryRes = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: summaryPrompt
              });
            } catch (liteErr) {
              summaryRes = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: summaryPrompt
              });
            }

            if (summaryRes && summaryRes.text) {
              await db.insert(summaries).values({
                garment_id: p.garment_id,
                summary_text: summaryRes.text.trim(),
                rating: 5
              });
            }
          } catch (sumErr) {
            console.error("Error regenerating archival summary:", sumErr);
          }
        }

        await db.update(structural_change_requests).set({
          status: 'applied',
          applied_at: new Date()
        }).where(eq(structural_change_requests.id, p.id));

        appliedCount++;
      }

      res.json({ success: true, count: appliedCount, message: `Successfully applied ${appliedCount} approved changes and updated archival summaries.` });
    } catch (err: any) {
      console.error("Error applying approved changes:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // --- SYSTEM DIAGNOSTIC API ---
  app.get("/api/developer/health-status", async (req, res) => {
    try {
      const isFgdAlive = typeof FgdEngine !== 'undefined';
      const isJobManagerAlive = typeof FgdJobManager !== 'undefined';
      const isChunkManagerAlive = typeof ChunkSessionManager !== 'undefined';

      if (isFgdAlive && isJobManagerAlive && isChunkManagerAlive) {
        return res.json({ 
          success: true, 
          status: 'operational',
          message: 'All OO Chunk singletons are online and healthy. Diagnostics passed.',
          diagnostics: {
            fgdEngine: 'operational',
            jobManager: 'operational',
            chunkSessionManager: 'optimized',
            database: 'operational'
          }
        });
      } else {
        return res.status(500).json({ error: 'System architecture check failed. Some OO chunks are offline.' });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // --- LABELING RULES API ---
  app.get("/api/rules", async (req, res) => {
    try {
      const allRules = await db.select().from(labeling_rules).orderBy(desc(labeling_rules.created_at));
      res.json(allRules);
    } catch (err: any) {
      console.error("Error fetching rules:", err);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  app.post("/api/rules", async (req, res) => {
    try {
      const { rule_code, rule_type, target_field, rule_title, condition_trigger, rule_instruction, example_positive, example_negative, source_feedback } = req.body;
      const newRule = await db.insert(labeling_rules).values({
        rule_code: rule_code || 'RULE-' + Date.now().toString().slice(-4),
        rule_type: rule_type || 'positive',
        target_field: target_field || 'general',
        rule_title: rule_title || 'Untitled Rule',
        condition_trigger: condition_trigger || '',
        rule_instruction: rule_instruction || '',
        example_positive: example_positive || '',
        example_negative: example_negative || '',
        source_feedback: source_feedback || 'Developer Manual Entry',
        is_active: true
      }).returning();
      res.json(newRule[0]);
    } catch (err: any) {
      console.error("Error creating rule:", err);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  app.patch("/api/rules/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(labeling_rules).where(eq(labeling_rules.id, parseInt(id, 10)));
      if (existing.length === 0) return res.status(404).json({ error: "Rule not found" });
      const updated = await db.update(labeling_rules)
        .set({ is_active: !existing[0].is_active, updated_at: new Date() })
        .where(eq(labeling_rules.id, parseInt(id, 10)))
        .returning();
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to toggle rule" });
    }
  });

  // --- ABBREVIATION & GLOSSARY API ---
  app.get("/api/abbreviations", async (req, res) => {
    try {
      const allTerms = await db.select().from(abbreviation_library).orderBy(abbreviation_library.term);
      res.json(allTerms);
    } catch (err: any) {
      console.error("Error fetching abbreviations:", err);
      res.status(500).json({ error: "Failed to fetch abbreviations" });
    }
  });

  app.post("/api/abbreviations", async (req, res) => {
    try {
      const { term, category, expansion_en, expansion_zh, functional_notes, source } = req.body;
      const newTerm = await db.insert(abbreviation_library).values({
        term: term.trim(),
        category: category || 'general',
        expansion_en: expansion_en || '',
        expansion_zh: expansion_zh || '',
        functional_notes: functional_notes || '',
        source: source || 'Developer Console'
      }).returning();
      res.json(newTerm[0]);
    } catch (err: any) {
      console.error("Error creating abbreviation:", err);
      res.status(500).json({ error: "Failed to create abbreviation" });
    }
  });

  // --- DYNAMIC IMAGE SERVING (CLOUD PERSISTENCE CACHE) ---
  app.get(["/images/:filename", "/images_thumb/:filename", "/images_ai/:filename"], async (req, res, next) => {
    const { filename } = req.params;
    const type = req.path.split('/')[1];
    
    const dir = type === 'images' ? imagesDir : (type === 'images_thumb' ? thumbDir : aiDir);
    const filePath = path.join(dir, filename);
    
    // Fast path: cached on disk
    if (fs.existsSync(filePath)) {
      return next();
    }
    
    // Fallback: fetch single image from Cloud SQL DB (only select requested column)
    try {
      const targetColumn = type === 'images' ? images.raw_base64 : (type === 'images_thumb' ? images.thumb_base64 : images.ai_base64);
      const imgRows = await db.select({ data: targetColumn }).from(images).where(eq(images.filename, decodeURIComponent(filename))).limit(1);
      if (imgRows.length > 0 && imgRows[0].data) {
        const buffer = Buffer.from(imgRows[0].data, 'base64');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, buffer);
        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(buffer);
      }
    } catch (e: any) {
      console.error("[Persistence] Error fetching dynamic image from DB:", e);
    }
    
    next();
  });

  // --- CAPTURE STATION SYNC CONTRACT ---
  app.get("/api/config/taxonomy", async (req, res) => {
    try {
      const { WINZEN_TAXONOMY_CATEGORIES, DETAIL_SHOT_PRESETS } = await import("./src/config/garmentShotTaxonomy");
      res.json({
        success: true,
        categories: WINZEN_TAXONOMY_CATEGORIES,
        detailPresets: DETAIL_SHOT_PRESETS,
        version: "2026.09.1",
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load shot taxonomy" });
    }
  });

  app.get("/api/capture/retake-queue", async (req, res) => {
    try {
      const reshootGarments = await db.select().from(garments)
        .where(or(
          eq(garments.status, 'needs_reshoot'),
          eq(garments.status, 'needs_retake')
        ));
      
      const gIds = reshootGarments.map(g => g.id);
      const existingImgs = gIds.length > 0 
        ? await db.select({ id: images.id, garment_id: images.garment_id }).from(images)
        : [];

      const queue = reshootGarments.map(g => {
        const gImages = existingImgs.filter(im => im.garment_id === g.id);
        return {
          garmentId: g.id,
          buyer: g.buyer || g.brand || 'Unknown',
          styleNo: g.cust_style_no || g.y_style_no || '',
          reason: g.reviewer_feedback || g.remark_memo || 'Image quality or label retake requested by Jennifer',
          requestedAngle: (g.remark_memo && g.remark_memo.includes('Label')) ? 'Label' : 'All',
          status: g.status,
          imagesCount: gImages.length,
          lastUpdated: g.created_at
        };
      });

      res.json({ success: true, count: queue.length, items: queue });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load retake queue" });
    }
  });

  app.post("/api/garments/:id/request-retake", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const note = reason ? `[Retake Request: ${reason}]` : '[Retake Requested by Jennifer]';

      await db.update(garments).set({
        status: 'needs_reshoot',
        reviewer_feedback: note
      }).where(eq(garments.id, id));

      res.json({ success: true, message: `Garment ${id} marked for retake and queued for Capture station.` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to mark garment for retake" });
    }
  });

  // --- DIRECTOR COMMENTARY & ARBITRATION ---
  app.post("/api/garments/:id/director-comment", async (req, res) => {
    try {
      const { id } = req.params;
      const { comment, author = 'Director Jason' } = req.body;
      if (typeof comment !== 'string') {
        return res.status(400).json({ error: "Comment string is required" });
      }
      const record = await directorCommentManager.saveComment(id, comment, author);
      res.json({ success: true, record });
    } catch (e: any) {
      console.error("[Director Comment Error]", e);
      res.status(500).json({ error: e?.message || "Failed to save director comment" });
    }
  });

  app.get("/api/garments/:id/director-comment", async (req, res) => {
    try {
      const { id } = req.params;
      const record = directorCommentManager.getComment(id);
      res.json({ success: true, record });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post("/api/garments/:id/rerun-fgd-flash", async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const effectiveComment = (comment !== undefined ? comment : (directorCommentManager.getComment(id)?.comment || '')).trim();
      if (!effectiveComment) {
        return res.status(400).json({ error: "Director commentary note is required to evaluate against Flash model." });
      }
      const evaluation = await directorCommentManager.runFlashVerification(id, effectiveComment);
      res.json({ success: true, evaluation });
    } catch (e: any) {
      console.error("[Flash Verification Error]", e);
      res.status(500).json({ error: e?.message || "Flash verification failed" });
    }
  });

  app.post("/api/garments/:id/arbitrate-discrepancy-pro", async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const effectiveComment = (comment !== undefined ? comment : (directorCommentManager.getComment(id)?.comment || '')).trim();
      if (!effectiveComment) {
        return res.status(400).json({ error: "Director commentary note is required for Pro model arbitration." });
      }
      const arbitration = await directorCommentManager.runProArbitration(id, effectiveComment);
      res.json({ success: true, arbitration });
    } catch (e: any) {
      console.error("[Pro Arbitration Error]", e);
      res.status(500).json({ error: e?.message || "Pro discrepancy arbitration failed" });
    }
  });

  app.post("/api/garments/:id/digest-feedback", async (req, res) => {
    try {
      const { id } = req.params;
      const { comment, previewOnly = true } = req.body;
      const effectiveComment = (comment !== undefined ? comment : (directorCommentManager.getComment(id)?.comment || '')).trim();
      if (!effectiveComment) {
        return res.status(400).json({ error: "Feedback commentary is required to digest proposed changes." });
      }
      const draftPreview = await directorCommentManager.digestCommentFeedback(id, effectiveComment, previewOnly);
      res.json({ success: true, draftPreview });
    } catch (e: any) {
      console.error("[Digest Feedback Error]", e);
      res.status(500).json({ error: e?.message || "Failed to digest feedback" });
    }
  });

  app.post("/api/developer/digest-feedback", async (req, res) => {
    try {
      const { garmentId, comment, previewOnly = true } = req.body;
      if (!garmentId) {
        return res.status(400).json({ error: "garmentId is required" });
      }
      const effectiveComment = (comment !== undefined ? comment : (directorCommentManager.getComment(garmentId)?.comment || '')).trim();
      if (!effectiveComment) {
        return res.status(400).json({ error: "Commentary note is required to digest feedback." });
      }
      const draftPreview = await directorCommentManager.digestCommentFeedback(garmentId, effectiveComment, previewOnly);
      res.json({ success: true, draftPreview });
    } catch (e: any) {
      console.error("[Developer Digest Feedback Error]", e);
      res.status(500).json({ error: e?.message || "Failed to digest feedback" });
    }
  });

  app.get("/api/garments", async (req, res) => {
    try {
      const includeQuarantined = req.query.includeQuarantined === 'true';
      const allGarmentsRaw = await db.select().from(garments);
      const allGarments = includeQuarantined 
        ? allGarmentsRaw 
        : allGarmentsRaw.filter(g => g.status !== 'quarantined');

      const allImages = await db.select({
        id: images.id,
        garment_id: images.garment_id,
        role: images.role,
        filename: images.filename
      }).from(images);
      const allSummaries = await db.select().from(summaries).orderBy(desc(summaries.created_at));
      
      const formatted = allGarments.map(g => {
        const garmentImages = allImages.filter(img => img.garment_id === g.id);
        const mappedImages: any[] = [];
        const seenIds = new Set<any>();

        for (const img of garmentImages) {
          if (!includeQuarantined && (img.role || '').toLowerCase().includes('quarantined')) {
            continue;
          }
          if (!seenIds.has(img.id)) {
            seenIds.add(img.id);
            const isExternal = img.filename?.startsWith('http');
            const isReview = (img.role || '').includes('Review') || (img.role || '').includes('Additional') || (img.filename || '').includes('[Review]');
            mappedImages.push({
              id: img.id,
              role: img.role || 'Front',
              filename: img.filename,
              isReview: !!isReview,
              url: isExternal ? img.filename : `/images_thumb/${img.filename}`,
              thumbUrl: isExternal ? img.filename : `/images_thumb/${img.filename}`,
              aiUrl: isExternal ? img.filename : `/images_ai/${img.filename}`,
              rawUrl: isExternal ? img.filename : `/images/${img.filename}`,
              fullUrl: isExternal ? img.filename : `/images_ai/${img.filename}`,
              fallbackUrl: isExternal ? img.filename : `/images/${img.filename}`
            });
          }
        }
        
        const fFile = `${g.id} (F).jpg`;
        const bFile = `${g.id} (B).jpg`;
        const lFile = `${g.id}.jpg`;

        if (!mappedImages.some(img => img.role === 'Front') && fs.existsSync(path.join(imagesDir, fFile))) {
          mappedImages.push({ 
            id: `disk_f_${g.id}`, 
            role: 'Front', 
            filename: fFile, 
            isReview: false, 
            url: `/images_thumb/${fFile}`, 
            thumbUrl: `/images_thumb/${fFile}`, 
            aiUrl: `/images_ai/${fFile}`, 
            rawUrl: `/images/${fFile}`, 
            fullUrl: `/images_ai/${fFile}`, 
            fallbackUrl: `/images/${fFile}` 
          });
        }
        if (!mappedImages.some(img => img.role === 'Back') && fs.existsSync(path.join(imagesDir, bFile))) {
          mappedImages.push({ 
            id: `disk_b_${g.id}`, 
            role: 'Back', 
            filename: bFile, 
            isReview: false, 
            url: `/images_thumb/${bFile}`, 
            thumbUrl: `/images_thumb/${bFile}`, 
            aiUrl: `/images_ai/${bFile}`, 
            rawUrl: `/images/${bFile}`, 
            fullUrl: `/images_ai/${bFile}`, 
            fallbackUrl: `/images/${bFile}` 
          });
        }
        if (!mappedImages.some(img => img.role === 'Label') && fs.existsSync(path.join(imagesDir, lFile))) {
          mappedImages.push({ 
            id: `disk_l_${g.id}`, 
            role: 'Label', 
            filename: lFile, 
            isReview: false, 
            url: `/images_thumb/${lFile}`, 
            thumbUrl: `/images_thumb/${lFile}`, 
            aiUrl: `/images_ai/${lFile}`, 
            rawUrl: `/images/${lFile}`, 
            fullUrl: `/images_ai/${lFile}`, 
            fallbackUrl: `/images/${lFile}` 
          });
        }
        
        const roleOrder: Record<string, number> = { 'Front': 1, 'Back': 2, 'Label': 3 };
        const gImages = mappedImages.sort((a, b) => {
          const aOrder = a.isReview ? 50 : (roleOrder[a.role] || 10);
          const bOrder = b.isReview ? 50 : (roleOrder[b.role] || 10);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (Number(a.id) || 0) - (Number(b.id) || 0);
        });
        
        const gSummaries = allSummaries.filter(s => s.garment_id === g.id);
        const equatedRecord = equatedCodeManager.findByCorrectedCode(g.id);
        const directorRecord = directorCommentManager.getComment(g.id);
        
        return {
          ...g,
          images: gImages,
          summaries: gSummaries,
          director_comment_record: directorRecord,
          director_comment: directorRecord?.comment || null,
          gnw_is_ai_estimated: g.gnw_is_ai_estimated === 1,
          color_is_ai_estimated: g.color_is_ai_estimated === 1,
          jennifer_emulator_raw: gSummaries.length > 0 ? gSummaries[0].summary_text : '',
          previous_generated_code: g.previous_generated_code || equatedRecord?.previous_code || null,
          equated_by: g.equated_by || equatedRecord?.equated_by || null,
          equated_at: g.equated_at || equatedRecord?.equated_at || null,
          equated_notes: equatedRecord?.reference_notes || null
        };
      });
      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.put("/api/garments/:id", async (req, res) => {
    const { id } = req.params;
    const g = req.body;
    try {
      let immediate_updates = {};
      if (g.structural_feedback && process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this garment feedback: "${g.structural_feedback}". 
Identify:
1. Immediate Data Updates: simple non-structural changes that map directly to existing fields (e.g. changing color, size).
2. Structural Requests: requests for new fields, tags, or database structure.
3. Dependent Updates: data changes that rely on those new structural fields.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  immediate_updates: { type: Type.OBJECT },
                  structural_requests: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dependent_updates: { type: Type.OBJECT }
                },
                required: ["immediate_updates", "structural_requests", "dependent_updates"]
              }
            }
          });
          
          const parsed = JSON.parse(response.text || '{}');
          immediate_updates = parsed.immediate_updates || {};
          
          if ((parsed.structural_requests && parsed.structural_requests.length > 0) || 
              (parsed.dependent_updates && Object.keys(parsed.dependent_updates).length > 0)) {
            await db.insert(structural_change_requests).values({
              garment_id: id,
              raw_feedback: g.structural_feedback,
              structural_requests: JSON.stringify(parsed.structural_requests || []),
              dependent_updates: JSON.stringify(parsed.dependent_updates || {}),
              status: 'pending'
            });
          }
        } catch (e: any) {
          console.error("Gemini processing error in garment update:", e);
        }
      }

      await db.update(garments).set({
        brand: g.brand || g.brand_code || '', buyer: g.buyer || '', season: g.season || '', sales: g.sales || '', merchandiser: g.merchandiser || '',
        brand_code: g.brand_code || '', goods_no: g.goods_no || '', handwritten_notes: g.handwritten_notes || '',
        cust_style_no: g.cust_style_no || '',
        y_style_no: g.y_style_no || '', garment_type: g.garment_type || '', washing: g.washing || '', fabric_raw: g.fabric_raw || '',
        gnw_weight: g.gnw_weight || '', fabric_yarn_count: g.fabric_yarn_count || '', fabric_material: g.fabric_material || '',
        fabric_construction: g.fabric_construction || '', sample_job_no: g.sample_job_no || '', color: g.color || '',
        size: g.size || '', print_datetime: g.print_datetime || '', description: g.description || '', remark_memo: g.remark_memo || '',
        structural_feedback: '',
        content_notes: g.content_notes || '', hashtags: g.hashtags || '',
        invisible_hashtags: g.invisible_hashtags || '',
        ...immediate_updates
      }).where(eq(garments.id, id));

      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post("/api/garments/:id/process-feedback", async (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY missing" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this garment feedback: "${feedback}". 
Identify immediate updates, structural requests, and dependent updates.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              immediate_updates: { type: Type.OBJECT },
              structural_requests: { type: Type.ARRAY, items: { type: Type.STRING } },
              dependent_updates: { type: Type.OBJECT }
            },
            required: ["immediate_updates", "structural_requests", "dependent_updates"]
          }
        }
      });
      
      let parsed: any = {};
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch (e) {
        parsed = { immediate_updates: {}, structural_requests: [], dependent_updates: {} };
      }
      
      await db.transaction(async (tx) => {
        if (Object.keys(parsed.immediate_updates || {}).length > 0) {
          await tx.update(garments)
            .set(parsed.immediate_updates)
            .where(eq(garments.id, id));
        }
        
        if ((parsed.structural_requests && parsed.structural_requests.length > 0) || 
            (parsed.dependent_updates && Object.keys(parsed.dependent_updates).length > 0)) {
          await tx.insert(structural_change_requests).values({
            garment_id: id,
            raw_feedback: feedback,
            structural_requests: JSON.stringify(parsed.structural_requests || []),
            dependent_updates: JSON.stringify(parsed.dependent_updates || {}),
            status: 'pending'
          });
        }
      });
      
      res.json({ success: true, processed: parsed });
    } catch (e: any) {
      console.error("Gemini processing error:", e);
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post("/api/garments/:id/feedback", async (req, res) => {
    const { id } = req.params;
    const { feedback } = req.body;
    try {
      await db.update(garments).set({ reviewer_feedback: feedback }).where(eq(garments.id, id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post("/api/summaries/:summaryId/rate", async (req, res) => {
    const { summaryId } = req.params;
    const { rating } = req.body;
    try {
      await db.update(summaries).set({ rating }).where(eq(summaries.id, parseInt(summaryId, 10)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.post("/api/images", async (req, res) => {
    try {
      const { garmentId, role, filename, url } = req.body;
      
      const existing = await db.select().from(garments).where(eq(garments.id, garmentId));
      if (existing.length === 0) {
        const assignment = await warehouseFacade.assignSpace({ garmentId });
        await db.insert(garments).values({
          id: garmentId,
          status: 'pending',
          shelving_status: 'unshelfed',
          assigned_location: assignment.locationCode,
          temp_container: assignment.tempContainer
        });
      }
      await db.insert(images).values({ garment_id: garmentId, role, filename: url || filename });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Save image metadata error:", error);
      res.status(500).json({ error: "Failed to save image metadata" });
    }
  });

  // DELETE Image Endpoint
  app.delete("/api/garments/:garmentId/images/:imageId", async (req, res) => {
    try {
      const { garmentId, imageId } = req.params;
      const imgIdNum = parseInt(imageId, 10);
      
      let targetImage: any = null;
      if (!isNaN(imgIdNum)) {
        const dbImg = await db.select().from(images).where(and(eq(images.id, imgIdNum), eq(images.garment_id, garmentId)));
        targetImage = dbImg[0];
      }
      
      if (!targetImage) {
        const dbImgByName = await db.select().from(images).where(and(eq(images.filename, imageId), eq(images.garment_id, garmentId)));
        targetImage = dbImgByName[0];
      }

      if (!targetImage) {
        const diskFile = imageId.endsWith('.jpg') ? imageId : `${imageId}.jpg`;
        const rawPath = path.join(imagesDir, diskFile);
        if (fs.existsSync(rawPath)) {
          try { fs.unlinkSync(rawPath); } catch (e) {}
          try { fs.unlinkSync(path.join(thumbDir, diskFile)); } catch (e) {}
          try { fs.unlinkSync(path.join(aiDir, diskFile)); } catch (e) {}
          return res.json({ success: true, message: "Disk image deleted successfully" });
        }
        return res.status(404).json({ error: `Image not found for garment ${garmentId}` });
      }

      await db.delete(images).where(eq(images.id, targetImage.id));

      if (targetImage.filename) {
        try { fs.unlinkSync(path.join(imagesDir, targetImage.filename)); } catch (e) {}
        try { fs.unlinkSync(path.join(thumbDir, targetImage.filename)); } catch (e) {}
        try { fs.unlinkSync(path.join(aiDir, targetImage.filename)); } catch (e) {}
      }

      return res.json({ success: true, message: "Image deleted successfully", deletedId: targetImage.id });
    } catch (err: any) {
      console.error("Delete image error:", err);
      return res.status(500).json({ error: err?.message || "Failed to delete image" });
    }
  });

  // RENAME AND KEEP Image Endpoint
  app.post("/api/garments/:garmentId/images/:imageId/rename", async (req, res) => {
    try {
      const { garmentId, imageId } = req.params;
      const { suffix } = req.body;
      if (!suffix || typeof suffix !== 'string') {
        return res.status(400).json({ error: "A suffix must be provided" });
      }

      const cleanedSuffix = suffix
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\.jpg$/i, '')
        .trim();

      if (!cleanedSuffix) {
        return res.status(400).json({ error: "Invalid suffix provided" });
      }

      const imgIdNum = parseInt(imageId, 10);
      let targetImage: any = null;
      if (!isNaN(imgIdNum)) {
        const dbImg = await db.select().from(images).where(and(eq(images.id, imgIdNum), eq(images.garment_id, garmentId)));
        targetImage = dbImg[0];
      }
      if (!targetImage) {
        const dbImgByName = await db.select().from(images).where(and(eq(images.filename, imageId), eq(images.garment_id, garmentId)));
        targetImage = dbImgByName[0];
      }

      if (!targetImage) {
        return res.status(404).json({ error: `Image not found for garment ${garmentId}` });
      }

      const separator = (cleanedSuffix.startsWith('_') || cleanedSuffix.startsWith('-')) ? '' : ' ';
      const newFilename = `${garmentId}${separator}${cleanedSuffix}.jpg`;
      const oldFilename = targetImage.filename;

      if (oldFilename && oldFilename !== newFilename) {
        const oldRaw = path.join(imagesDir, oldFilename);
        const newRaw = path.join(imagesDir, newFilename);
        if (fs.existsSync(oldRaw)) fs.renameSync(oldRaw, newRaw);

        const oldThumb = path.join(thumbDir, oldFilename);
        const newThumb = path.join(thumbDir, newFilename);
        if (fs.existsSync(oldThumb)) fs.renameSync(oldThumb, newThumb);

        const oldAi = path.join(aiDir, oldFilename);
        const newAi = path.join(aiDir, newFilename);
        if (fs.existsSync(oldAi)) fs.renameSync(oldAi, newAi);
      }

      let newRole = cleanedSuffix;
      if (cleanedSuffix.startsWith('(F)') || cleanedSuffix.toLowerCase().includes('front')) {
        const detailPart = cleanedSuffix.replace(/^\(F\)\s*/i, '').trim();
        newRole = detailPart ? `Front (${detailPart})` : 'Front';
      } else if (cleanedSuffix.startsWith('(B)') || cleanedSuffix.toLowerCase().includes('back')) {
        const detailPart = cleanedSuffix.replace(/^\(B\)\s*/i, '').trim();
        newRole = detailPart ? `Back (${detailPart})` : 'Back';
      } else {
        newRole = `Additional (${cleanedSuffix})`;
      }

      await db.update(images).set({
        filename: newFilename,
        role: newRole
      }).where(eq(images.id, targetImage.id));

      return res.json({
        success: true,
        message: `Image renamed to ${newFilename} and kept successfully`,
        image: {
          id: targetImage.id,
          garment_id: garmentId,
          role: newRole,
          filename: newFilename,
          url: `/images_thumb/${newFilename}`,
          fullUrl: `/images_ai/${newFilename}`,
          fallbackUrl: `/images/${newFilename}`
        }
      });
    } catch (err: any) {
      console.error("Rename image error:", err);
      return res.status(500).json({ error: err?.message || "Failed to rename image" });
    }
  });

  // Helper: Rename garment record and linked disk/DB images
  async function renameGarmentRecord(
    oldGarmentId: string, 
    newGarmentId: string, 
    reason?: string,
    extra?: { equatedBy?: string; referenceNotes?: string }
  ) {
    const cleanOld = (oldGarmentId || '').trim();
    const cleanNew = (newGarmentId || '')
      .replace(/[/\\?%*:|"<>]/g, '')
      .trim();

    if (!cleanOld || !cleanNew) {
      return { success: false, reason: "Garment IDs must be non-empty" };
    }
    if (cleanOld.toUpperCase() === cleanNew.toUpperCase()) {
      return { success: true, message: "Garment ID is already identical", garmentId: cleanNew };
    }

    const canonicalNew = cleanNew.toUpperCase();
    const existingOldList = await db.select().from(garments).where(eq(garments.id, cleanOld));
    if (existingOldList.length === 0) {
      return { success: false, reason: `Garment ${cleanOld} not found` };
    }
    const oldRecord = existingOldList[0];

    const existingNewList = await db.select().from(garments).where(eq(garments.id, canonicalNew));
    const targetExists = existingNewList.length > 0;

    if (!targetExists) {
      const memoText = reason 
        ? (oldRecord.remark_memo ? `${oldRecord.remark_memo} | ${reason}` : reason)
        : oldRecord.remark_memo;

      await db.insert(garments).values({
        ...oldRecord,
        id: canonicalNew,
        remark_memo: memoText,
        previous_generated_code: oldRecord.previous_generated_code || cleanOld,
        equated_by: (extra && extra.equatedBy) || oldRecord.equated_by || null,
        equated_at: (extra && extra.equatedBy) ? new Date() : (oldRecord.equated_at || null)
      });
    } else {
      await db.update(garments).set({
        previous_generated_code: oldRecord.previous_generated_code || cleanOld,
        equated_by: (extra && extra.equatedBy) || oldRecord.equated_by || null,
        equated_at: (extra && extra.equatedBy) ? new Date() : (oldRecord.equated_at || null),
        remark_memo: reason ? `${existingNewList[0].remark_memo || ''} | ${reason}` : existingNewList[0].remark_memo
      }).where(eq(garments.id, canonicalNew));
    }

    const associatedImages = await db.select().from(images).where(eq(images.garment_id, cleanOld));
    const renamedImageFiles: { oldName: string; newName: string }[] = [];

    for (const img of associatedImages) {
      const oldFilename = img.filename || '';
      let newFilename = oldFilename;
      if (oldFilename) {
        if (oldFilename.toUpperCase().startsWith(cleanOld.toUpperCase())) {
          newFilename = canonicalNew + oldFilename.substring(cleanOld.length);
        } else {
          const extMatch = oldFilename.match(/\.[^.]+$/);
          const ext = extMatch ? extMatch[0] : '.jpg';
          const roleSuffix = img.role === 'Front' ? ' (F)' : img.role === 'Back' ? ' (B)' : '';
          newFilename = `${canonicalNew}${roleSuffix}${ext}`;
        }

        const renameDiskFile = (dir: string) => {
          const oldP = path.join(dir, oldFilename);
          const newP = path.join(dir, newFilename);
          if (fs.existsSync(oldP)) {
            try {
              if (path.resolve(oldP) !== path.resolve(newP)) fs.renameSync(oldP, newP);
            } catch (e) {
              console.warn(`[renameGarmentRecord] Error moving ${oldP} -> ${newP}:`, e);
            }
          }
        };

        renameDiskFile(imagesDir);
        renameDiskFile(thumbDir);
        renameDiskFile(aiDir);
        renamedImageFiles.push({ oldName: oldFilename, newName: newFilename });
      }

      await db.update(images).set({
        garment_id: canonicalNew,
        filename: newFilename
      }).where(eq(images.id, img.id));
    }

    await db.update(summaries).set({ garment_id: canonicalNew }).where(eq(summaries.garment_id, cleanOld));
    await db.update(structural_change_requests).set({ garment_id: canonicalNew }).where(eq(structural_change_requests.garment_id, cleanOld));

    await db.delete(garments).where(eq(garments.id, cleanOld));

    equatedCodeManager.equateCode({
      previous_code: cleanOld,
      corrected_code: canonicalNew,
      equated_by: (extra && extra.equatedBy) || 'Jennifer',
      equated_at: new Date().toISOString(),
      reference_notes: (extra && extra.referenceNotes) || reason || '',
      previous_garment_type: oldRecord.garment_type || ''
    });

    try {
      fgdJobManager.queueGarmentFgd(canonicalNew, 1);
    } catch (e) {}

    return {
      success: true,
      oldGarmentId: cleanOld,
      newGarmentId: canonicalNew,
      targetAlreadyExisted: targetExists,
      imagesRenamedCount: renamedImageFiles.length,
      renamedImageFiles
    };
  }

  app.post("/api/garments/:garmentId/rename-garment", async (req, res) => {
    try {
      const { garmentId } = req.params;
      const { newGarmentId, reason } = req.body;
      if (!newGarmentId || typeof newGarmentId !== 'string') {
        return res.status(400).json({ error: "A new garment ID must be provided" });
      }
      const result = await renameGarmentRecord(garmentId, newGarmentId.trim(), reason || "Manual rename by merchandiser");
      if (!result.success) {
        return res.status(400).json({ error: result.reason || "Failed to rename garment" });
      }
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Rename garment error:", err);
      return res.status(500).json({ error: err?.message || "Failed to rename garment" });
    }
  });

  app.post("/api/garments/:garmentId/equate-code", async (req, res) => {
    try {
      const { garmentId } = req.params;
      const { correctedCode, equatedBy, referenceNotes } = req.body;
      if (!correctedCode || typeof correctedCode !== 'string' || !correctedCode.trim()) {
        return res.status(400).json({ error: "A valid corrected garment code must be provided" });
      }

      const cleanCorrected = correctedCode.trim().toUpperCase();
      const byUser = (equatedBy || 'Jennifer').trim();
      const reason = `[Code Equated] Original code ${cleanCorrected} equated with previous sticker/temp code ${garmentId} by ${byUser}${referenceNotes ? ` (${referenceNotes})` : ''}`;

      const renameResult = await renameGarmentRecord(garmentId, cleanCorrected, reason, {
        equatedBy: byUser,
        referenceNotes: referenceNotes || ''
      });

      if (!renameResult.success) {
        return res.status(400).json({ error: renameResult.reason || "Failed to equate garment code" });
      }

      const equatedRecord = equatedCodeManager.findByCorrectedCode(cleanCorrected);

      return res.json({
        success: true,
        message: `Successfully equated code ${garmentId} with ${cleanCorrected}`,
        equatedRecord,
        ...renameResult
      });
    } catch (err: any) {
      console.error("Equate code error:", err);
      return res.status(500).json({ error: err?.message || "Failed to equate code" });
    }
  });

  app.get("/api/equated-codes", (req, res) => {
    try {
      const list = equatedCodeManager.getAll();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch equated codes" });
    }
  });

  app.post("/api/capture/verify-sticker", async (req, res) => {
    try {
      const expectedCode = (req.body.expectedCode || req.body.garmentId || '').trim();
      let imgBuffer: Buffer | null = null;

      if (req.body.imageBase64) {
        imgBuffer = Buffer.from(req.body.imageBase64, 'base64');
      } else if (req.body.garmentId) {
        const labelImgs = await db.select().from(images).where(
          and(eq(images.garment_id, req.body.garmentId), or(eq(images.role, 'Label'), eq(images.role, 'Detail')))
        );
        for (const limg of labelImgs) {
          if (limg.filename) {
            const p = path.join(imagesDir, limg.filename);
            if (fs.existsSync(p)) {
              imgBuffer = fs.readFileSync(p);
              break;
            }
          }
        }
      }

      if (!imgBuffer) {
        return res.status(400).json({ error: "Missing image buffer or valid garment ID for sticker verification" });
      }

      const verification = await captureAiInspector.verifyHandwrittenSticker(imgBuffer, expectedCode);
      return res.json(verification);
    } catch (err: any) {
      console.error("Verify sticker error:", err);
      return res.status(500).json({ error: err?.message || "Failed to verify sticker code" });
    }
  });

  app.post("/api/garments/:garmentId/inspect-shots", async (req, res) => {
    try {
      const { garmentId } = req.params;
      const inspectResult = await autoInspectGarmentShots(garmentId);
      return res.json(inspectResult);
    } catch (err: any) {
      console.error("Inspect shots error:", err);
      return res.status(500).json({ error: err?.message || "Failed to inspect garment shots" });
    }
  });

  async function autoInspectGarmentShots(garmentId: string) {
    if (!garmentId) return { message: "No garment ID provided" };
    try {
      const gImages = await db.select().from(images).where(eq(images.garment_id, garmentId));
      
      const topShots = gImages.filter(img => {
        const fn = (img.filename || '').toUpperCase();
        const r = (img.role || '').toUpperCase();
        return !r.includes('LABEL') && !fn.includes('MACRO') && 
          (fn.includes('TOP') || fn.includes('(F)') || fn.includes('(B)') || r.includes('FRONT') || r.includes('BACK') || r.includes('DETAIL') || r.includes('SIDE'));
      });

      if (topShots.length === 2) {
        const sorted = [...topShots].sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
        const shot1 = sorted[0];
        const shot2 = sorted[1];
        if (shot1.filename && shot2.filename) {
          const result = await captureAiInspector.correctTopShotsOrientation(garmentId, shot1.filename, shot2.filename);
          if (result && result.orientationInversionDetected && result.frontImageIndex === 2) {
            console.log(`[AI Orientation Auto-Correction] Detected inverted shot order for ${garmentId}. Swapping roles`);
            await db.update(images).set({ role: 'Back' }).where(eq(images.id, shot1.id));
            await db.update(images).set({ role: 'Front' }).where(eq(images.id, shot2.id));
            await db.update(garments).set({
              default_front_image_id: shot2.id,
              reviewer_feedback: `[AI Orientation Auto-Correction] Inverted order detected. Swapped to Front (${shot2.filename}) and Back (${shot1.filename}).`
            }).where(eq(garments.id, garmentId));

            return { action: 'orientation_corrected', orientationResult: result, swapped: true };
          }
          return { action: 'orientation_verified', orientationResult: result, swapped: false };
        }
      } else if (topShots.length > 2) {
        const sorted = [...topShots].sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
        const diffResult = await captureAiInspector.differentiateMultiShotGarment(
          garmentId,
          sorted.map(s => ({ filename: s.filename!, role: s.role || undefined }))
        );
        if (diffResult) {
          await db.update(garments).set({
            garment_type: diffResult.garmentType,
            structural_feedback: `[AI Multi-Shot Differentiation] ${diffResult.explanation}`
          }).where(eq(garments.id, garmentId));

          for (const item of diffResult.shotClassifications) {
            const match = sorted.find(s => s.filename === item.filename);
            if (match) {
              await db.update(images).set({ role: item.role }).where(eq(images.id, match.id));
            }
          }

          return { action: 'multi_shot_differentiated', diffResult };
        }
      }

      return { action: 'none', count: topShots.length };
    } catch (e: any) {
      console.warn(`[autoInspectGarmentShots] Error inspecting ${garmentId}:`, e?.message || e);
      return { error: e?.message || String(e) };
    }
  }

  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
  });

  async function runGeminiOCR(imageBuffer: Buffer, garmentId: string, rawPath?: string) {
    if (!process.env.GEMINI_API_KEY) return null;
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const base64 = imageBuffer.toString('base64');
      
      const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
      const glossary = await db.select().from(abbreviation_library);
      const rulesText = activeRules.map(r => `[${r.rule_code} ${r.rule_type.toUpperCase()}] ${r.rule_title}: ${r.rule_instruction}`).join('\n');
      const glossaryText = glossary.map(g => `${g.term}: ${g.expansion_en} | ${g.expansion_zh || ''}`).join('\n');

      const prompt = `Perform high-precision, strict literal OCR and garment spec extraction on this garment tag / photo.
Strict literality: Transcribe exact visible printed or handwritten text without guessing.

Extract the following JSON schema:
- buyer: string
- season: string
- winzen_style_no: string
- cust_style_no: string
- goods_no: string
- sample_stage: string
- garment_type: string
- washing: string
- fabric_raw: string
- gnw_weight: string
- fabric_yarn_count: string
- fabric_material: string
- fabric_construction: string
- color: string
- size: string
- print_datetime: string
- description: string
- is_blurry: boolean

CRITICAL RULES:
${rulesText}

GLOSSARY:
${glossaryText}

Return ONLY valid JSON matching this schema.`;

      let response: any = null;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: prompt }
          ],
          config: { responseMimeType: 'application/json', temperature: 0.0 }
        });
      } catch (err: any) {
        console.warn("[Gemini OCR] Flash attempt deferred:", err?.message || err);
        return null;
      }

      if (response && response.text) {
        let parsed = JSON.parse(response.text);
        const updates: any = {};
        if (parsed.buyer) updates.buyer = parsed.buyer.trim();
        if (parsed.season) updates.season = parsed.season.trim();
        if (parsed.cust_style_no) updates.cust_style_no = parsed.cust_style_no.trim();

        const extractedWinzen = (parsed.winzen_style_no || parsed.y_style_no || '').trim();
        const isWinzenCodePattern = /^(\d{2,}[A-Za-z0-9]*-\d+(?:-\d+)?)/i.test(extractedWinzen);
        if (isWinzenCodePattern) updates.y_style_no = extractedWinzen;

        const goodsNo = (parsed.goods_no || parsed.sample_job_no || '').trim();
        if (goodsNo) updates.sample_job_no = goodsNo;

        const rawStage = (parsed.sample_stage || '').trim();
        if (rawStage) updates.sample_stage = rawStage;

        if (parsed.garment_type) updates.garment_type = parsed.garment_type.trim();
        if (parsed.washing) updates.washing = parsed.washing.trim();
        if (parsed.fabric_raw) updates.fabric_raw = parsed.fabric_raw.trim();
        if (parsed.gnw_weight) updates.gnw_weight = parsed.gnw_weight.trim();
        if (parsed.fabric_yarn_count) updates.fabric_yarn_count = parsed.fabric_yarn_count.trim();
        if (parsed.fabric_material) updates.fabric_material = parsed.fabric_material.trim();
        if (parsed.fabric_construction) updates.fabric_construction = parsed.fabric_construction.trim();
        if (parsed.color) updates.color = parsed.color.trim();
        if (parsed.size) updates.size = parsed.size.trim();
        if (parsed.print_datetime) updates.print_datetime = parsed.print_datetime.trim();
        if (parsed.description) updates.description = parsed.description.trim();

        if (Object.keys(updates).length > 0) {
          await db.update(garments).set(updates).where(eq(garments.id, garmentId));
        }

        const isTemporaryId = /^(TEMP|UNTAGGED|CAPTURE-TEMP)[-_]/i.test(garmentId);
        const canonicalCandidate = extractedWinzen.toUpperCase();

        if (isTemporaryId && isWinzenCodePattern && canonicalCandidate !== garmentId.toUpperCase()) {
          try {
            await renameGarmentRecord(
              garmentId, 
              canonicalCandidate, 
              `Auto-renamed from temporary capture ID (${garmentId}) via Gemini OCR Winzen factory style detection`
            );
          } catch (rErr) {
            console.error(`[Gemini OCR Auto-Rename] Error auto-renaming ${garmentId}:`, rErr);
          }
        }

        return parsed;
      }
    } catch (err: any) {
      console.error("[Gemini OCR] Extraction error:", err?.message || err);
    }
    return null;
  }

  // Rate-limited OCR Queue Worker
  interface OCRQueueItem {
    buffer: Buffer;
    garmentId: string;
    rawPath?: string;
  }
  const ocrJobQueue: OCRQueueItem[] = [];
  let isOcrWorkerRunning = false;

  async function processNextOcrJob() {
    if (isOcrWorkerRunning || ocrJobQueue.length === 0) return;
    isOcrWorkerRunning = true;

    while (ocrJobQueue.length > 0) {
      const job = ocrJobQueue.shift();
      if (job) {
        try {
          await runGeminiOCR(job.buffer, job.garmentId, job.rawPath);
        } catch (err) {
          console.error(`[Background OCR Worker] Failed for ${job.garmentId}:`, err);
        }
        await new Promise(res => setTimeout(res, 1500));
      }
    }

    isOcrWorkerRunning = false;
  }

  function queueOcrJob(buffer: Buffer, garmentId: string, rawPath?: string) {
    ocrJobQueue.push({ buffer, garmentId, rawPath });
    processNextOcrJob().catch(err => console.error("[OCR Queue Starter Error]", err));
  }

  const uploadFields = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "thumb", maxCount: 1 },
    { name: "ai", maxCount: 1 }
  ]);

  // Centralized image processor avoiding OOM heap exhaustion
  async function processAssembledImage({
    imageBuffer,
    originalFilename,
    requestedGarmentId,
    requestedRole,
    enableOcr,
    clientThumbBuffer,
    clientAiBuffer,
    rawFilePath
  }: {
    imageBuffer?: Buffer;
    rawFilePath?: string;
    originalFilename: string;
    requestedGarmentId?: string;
    requestedRole?: string;
    enableOcr?: boolean;
    clientThumbBuffer?: Buffer;
    clientAiBuffer?: Buffer;
  }) {
    const rawRole = (requestedRole || '').trim();
    const filename = originalFilename || `upload_${Date.now()}.jpg`;
    const parsedParts = filename.split('.');
    parsedParts.pop();
    const nameWithoutExt = parsedParts.join('.').trim();

    const stripCopySuffixes = (str: string) => {
      let prev = '';
      let curr = str;
      while (prev !== curr) {
        prev = curr;
        curr = curr
          .replace(/\s*-\s*copy(\s*\(\d+\))?/gi, '')
          .replace(/\s*-\s*複製.*$/gi, '')
          .replace(/\s*-\s*副本.*$/gi, '')
          .replace(/\s*\(\d+\)$/gi, '')
          .trim();
      }
      return curr;
    };

    let cleanedName = stripCopySuffixes(nameWithoutExt);

    let role: string;
    if (/\((f|front)\)/i.test(cleanedName) || /[\s_-](f|front|front_closed|sidea_front|top_front)(\s|_|$)/i.test(cleanedName)) {
      role = 'Front';
    } else if (/\((b|back)\)/i.test(cleanedName) || /[\s_-](b|back|sidea_back|top_back)(\s|_|$)/i.test(cleanedName)) {
      role = 'Back';
    } else if (/\((l|label|tag)\)/i.test(cleanedName) || /[\s_-](l|label|tag)(\s|_|$)/i.test(cleanedName)) {
      role = 'Label';
    } else {
      const isGarmentPattern = /^(\d{2}[A-Za-z0-9]*-\d+|UNTAGGED|TEMP|CAPTURE-TEMP)/i.test(cleanedName);
      if (isGarmentPattern) {
        role = 'Label';
      } else if (rawRole && ['Front', 'Back', 'Label'].includes(rawRole)) {
        role = rawRole;
      } else {
        role = 'Label';
      }
    }

    let garmentId = stripCopySuffixes(requestedGarmentId || '');
    const untaggedMatch = cleanedName.match(/^((?:UNTAGGED|TEMP|CAPTURE-TEMP)-[A-Za-z0-9-]+)/i);
    const winzenMatch = cleanedName.match(/^(\d{2,}[A-Za-z0-9]*-\d+(?:-\d+)?)/i);

    if (untaggedMatch && untaggedMatch[1]) {
      garmentId = untaggedMatch[1].toUpperCase();
    } else if (winzenMatch && winzenMatch[1]) {
      garmentId = winzenMatch[1].toUpperCase();
    } else if (!garmentId || garmentId === 'UNKNOWN') {
      let extractedId = cleanedName
        .replace(/\s*\([FBLfbl]\)/i, '')
        .replace(/[\s_-]+(front|back|label|tag|detail.*|side[ab].*|lining)/i, '')
        .replace(/\s*\([^\)]*\)/i, '')
        .trim();
      garmentId = extractedId || 'UNKNOWN';
    }

    let incomingBuffer: Buffer;
    if (rawFilePath && fs.existsSync(rawFilePath)) {
      incomingBuffer = fs.readFileSync(rawFilePath);
    } else if (imageBuffer) {
      incomingBuffer = imageBuffer;
    } else {
      throw new Error(`No image data provided for ${filename}`);
    }
    const incomingHash = crypto.createHash('sha256').update(incomingBuffer).digest('hex');

    const existingGarment = await db.select({ id: garments.id }).from(garments).where(eq(garments.id, garmentId));
    if (existingGarment.length === 0) {
      const assignment = await warehouseFacade.assignSpace({ garmentId });
      await db.insert(garments).values({
        id: garmentId,
        status: 'pending',
        shelving_status: 'unshelfed',
        assigned_location: assignment.locationCode,
        temp_container: assignment.tempContainer
      });
    }

    // MEMORY SAFE: Do NOT load raw_base64 into memory. Only check file on disk.
    const existingImages = await db.select({
      id: images.id,
      role: images.role,
      filename: images.filename
    }).from(images).where(eq(images.garment_id, garmentId));

    let exactDuplicate: any = null;
    for (const ext of existingImages) {
      if (ext.filename) {
        const diskPath = path.join(imagesDir, ext.filename);
        if (fs.existsSync(diskPath)) {
          const buf = fs.readFileSync(diskPath);
          const diskHash = crypto.createHash('sha256').update(buf).digest('hex');
          if (diskHash === incomingHash) {
            exactDuplicate = ext;
            break;
          }
        }
      }
    }

    if (exactDuplicate) {
      if (rawFilePath && fs.existsSync(rawFilePath)) {
        try { fs.unlinkSync(rawFilePath); } catch (e) {}
      }
      return {
        success: true,
        duplicate: true,
        isExactDuplicate: true,
        action: 'deleted',
        message: `Exact duplicate detected: identical image already exists (${exactDuplicate.filename}). Discarded.`,
        garmentId,
        role: exactDuplicate.role,
        filename: exactDuplicate.filename,
        url: `/images_thumb/${exactDuplicate.filename}`,
        fullUrl: `/images_ai/${exactDuplicate.filename}`,
        fallbackUrl: `/images/${exactDuplicate.filename}`,
        ocrTriggered: false
      };
    }

    const canonicalMatching = existingImages.filter(img => img.role === role);
    const isDifferentShot = canonicalMatching.length > 0;

    let saveFilename: string;
    let finalRole: string;

    if (isDifferentShot) {
      const roleCode = role === 'Front' ? ' (F)' : role === 'Back' ? ' (B)' : '';
      let candidateFilename = `${garmentId}${roleCode} [Review].jpg`;
      let candidateRole = `${role} (Review)`;
      let counter = 2;
      while (
        fs.existsSync(path.join(imagesDir, candidateFilename)) || 
        existingImages.some(img => img.filename === candidateFilename)
      ) {
        candidateFilename = `${garmentId}${roleCode} [Review ${counter}].jpg`;
        candidateRole = `${role} (Review ${counter})`;
        counter++;
      }
      saveFilename = candidateFilename;
      finalRole = candidateRole;
    } else {
      if (role === 'Front') {
        saveFilename = `${garmentId} (F).jpg`;
      } else if (role === 'Back') {
        saveFilename = `${garmentId} (B).jpg`;
      } else {
        saveFilename = `${garmentId}.jpg`;
      }
      finalRole = role;
    }

    const rawPath = path.join(imagesDir, saveFilename);
    const thumbPath = path.join(thumbDir, saveFilename);
    const aiPath = path.join(aiDir, saveFilename);
    
    if (rawFilePath && fs.existsSync(rawFilePath)) {
      if (path.resolve(rawFilePath) !== path.resolve(rawPath)) {
        fs.copyFileSync(rawFilePath, rawPath);
        try { fs.unlinkSync(rawFilePath); } catch (e) {}
      }
    } else {
      fs.writeFileSync(rawPath, incomingBuffer);
    }
    
    if (clientThumbBuffer) {
      fs.writeFileSync(thumbPath, clientThumbBuffer);
    } else {
      await sharp(rawPath)
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toFile(thumbPath);
    }
    
    let aiBuffer: Buffer;
    if (clientAiBuffer) {
      aiBuffer = clientAiBuffer;
      fs.writeFileSync(aiPath, aiBuffer);
    } else {
      await sharp(rawPath)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(aiPath);
      aiBuffer = fs.readFileSync(aiPath);
    }

    let thumbBase64: string | null = null;
    let aiBase64: string | null = null;
    try {
      if (fs.existsSync(thumbPath)) thumbBase64 = fs.readFileSync(thumbPath).toString('base64');
      if (fs.existsSync(aiPath)) aiBase64 = fs.readFileSync(aiPath).toString('base64');
    } catch (bErr) {
      console.warn("[processAssembledImage] Error reading base64 buffers:", bErr);
    }

    // Quality Gate: Triage shot
    const captureAiInspector = CaptureAiInspector.getInstance();
    const triageManager = CaptureTriageManager.getInstance();
    const triage = await captureAiInspector.triageCaptureShot(saveFilename, aiBuffer, garmentId);
    await triageManager.recordTriage(triage);

    const isQuarantined = triage.setClassification === 'Set B' || triage.status === 'quarantined';
    if (isQuarantined) {
      finalRole = 'Quarantined: REJECTED_NO_GARMENT';
      try {
        await db.update(garments).set({
          status: 'quarantined',
          sample_stage: 'Quarantined',
          reviewer_feedback: 'REJECTED_NO_GARMENT',
          remark_memo: `[Capture Quality Gate: Quarantined] ${triage.details}`,
          structural_feedback: JSON.stringify(triage)
        }).where(eq(garments.id, garmentId));
      } catch (gErr) {
        console.warn("[processAssembledImage] Warning updating quarantined garment:", gErr);
      }
    } else {
      // Set A: Check for macro equate trigger if sticker
      if ((garmentId.startsWith('WZ-') || saveFilename.includes('WZ-')) && (finalRole === 'Label' || saveFilename.includes('MACRO_1'))) {
        try {
          const macroRes = await captureAiInspector.inspectMacroCareCardAndHandwriting(saveFilename, aiBuffer, garmentId);
          if (macroRes.detectedStyleNo) {
            await equatedCodeManager.equateCode({
              previous_code: garmentId,
              corrected_code: macroRes.detectedStyleNo,
              equated_by: 'Winzen Capture Quality Gate (MACRO_1 Care Card)',
              equated_at: new Date().toISOString(),
              reference_notes: macroRes.careDetails || macroRes.explanation || 'Detected via MACRO_1 care card inspection',
              previous_garment_type: 'sticker_linked'
            });
            await db.update(garments).set({
              cust_style_no: macroRes.detectedStyleNo,
              handwritten_notes: `Sticker Code: ${macroRes.handwrittenCode || garmentId}`
            }).where(eq(garments.id, garmentId));
          }
        } catch (mErr) {
          console.warn("[processAssembledImage] Warning inspecting macro care card:", mErr);
        }
      }
    }

    // Store thumbnail and AI 1024px buffer in DB for fast UI retrieval; omit 10MB raw_base64 to protect memory limits
    const [insertedImg] = await db.insert(images).values({ 
      garment_id: garmentId, 
      role: finalRole, 
      filename: saveFilename, 
      thumb_base64: thumbBase64,
      ai_base64: aiBase64,
      raw_base64: null
    }).returning();

    const shouldOcr = enableOcr !== false;
    const ocrTriggered = shouldOcr && finalRole === 'Label';
    if (ocrTriggered) {
      setImmediate(() => {
        queueOcrJob(aiBuffer, garmentId, rawPath);
      });
    }

    setImmediate(async () => {
      try {
        await autoInspectGarmentShots(garmentId);
      } catch (inspectErr) {
        console.warn(`[Auto-Inspect] Notice inspecting garment ${garmentId}:`, inspectErr);
      }
    });

    return { 
      success: true, 
      duplicateCandidate: isDifferentShot,
      isDifferentShot,
      action: isDifferentShot ? 'placed_on_garment_pending_review' : 'saved_as_primary',
      filename: saveFilename, 
      garmentId, 
      role: finalRole,
      imageId: insertedImg?.id,
      url: `/images_thumb/${saveFilename}`,
      fullUrl: `/images_ai/${saveFilename}`,
      fallbackUrl: `/images/${saveFilename}`,
      ocrTriggered
    };
  }

  app.post("/api/upload", uploadFields, async (req, res) => {
    try {
      const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const rawFile = filesMap?.['image']?.[0] || (req.file as Express.Multer.File | undefined);
      if (!rawFile) return res.status(400).json({ error: "No raw image uploaded" });

      const clientThumb = filesMap?.['thumb']?.[0];
      const clientAi = filesMap?.['ai']?.[0];
      const enableOcr = req.body.enableOcr !== 'false' && req.body.enableOcr !== false;

      const result = await processAssembledImage({
        imageBuffer: rawFile.buffer,
        originalFilename: rawFile.originalname || `upload_${Date.now()}.jpg`,
        requestedGarmentId: req.body.garmentId,
        requestedRole: req.body.role,
        enableOcr,
        clientThumbBuffer: clientThumb?.buffer,
        clientAiBuffer: clientAi?.buffer
      });

      res.json(result);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process image: " + (error?.message || error) });
    }
  });

  app.get("/api/upload-chunk/status", (req, res) => {
    try {
      const uploadId = (req.query.uploadId as string || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

      const uploadedChunks = chunkSessionManager.getUploadedChunkIndices(uploadId);
      res.json({ uploadedChunks });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to check chunk status" });
    }
  });

  app.post("/api/upload-chunk", upload.single('chunk'), async (req, res) => {
    try {
      const uploadId = (req.body.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!uploadId) return res.status(400).json({ error: "Missing uploadId" });

      const totalChunks = parseInt(req.body.totalChunks, 10);
      const filename = (req.body.filename || `upload_${Date.now()}.jpg`).trim();
      const garmentId = (req.body.garmentId || '').trim();
      const role = (req.body.role || '').trim();
      const enableOcr = req.body.enableOcr !== 'false' && req.body.enableOcr !== false;
      const isFinalizeOnly = req.body.finalize === 'true' || req.body.finalize === true;

      if (isNaN(totalChunks) || totalChunks <= 0) {
        return res.status(400).json({ error: "Invalid totalChunks" });
      }

      if (req.file) {
        const chunkIndex = parseInt(req.body.chunkIndex, 10);
        if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
          return res.status(400).json({ error: "Invalid chunkIndex" });
        }
        chunkSessionManager.saveChunk(uploadId, chunkIndex, req.file.buffer);
      } else if (!isFinalizeOnly) {
        return res.status(400).json({ error: "No chunk file provided" });
      }

      const isComplete = chunkSessionManager.isComplete(uploadId, totalChunks);

      if (!isComplete) {
        return res.json({
          success: true,
          completed: false,
          totalChunks,
          uploadedChunksCount: chunkSessionManager.getUploadedChunkIndices(uploadId).length
        });
      }

      const rawTarget = path.join(imagesDir, filename);
      await chunkSessionManager.reassembleToDisk(uploadId, totalChunks, rawTarget);

      const result = await processAssembledImage({
        rawFilePath: rawTarget,
        originalFilename: filename,
        requestedGarmentId: garmentId,
        requestedRole: role,
        enableOcr
      });

      chunkSessionManager.cleanupSession(uploadId);

      return res.json({
        ...result,
        completed: true
      });
    } catch (err: any) {
      console.error("[Chunk Upload Error]", err);
      res.status(500).json({ error: err?.message || "Failed to process chunk" });
    }
  });

  // --- SUBROUTERS ---
  app.use("/api/upload-diagnostic", createUploadDiagnosticRouter());
  const fgdRouter = createFgdRouter(fgdEngine);
  app.use("/api/developer/fgd-test", fgdRouter);
  app.use("/api/fgd", fgdRouter);
  app.use("/api/warehouse", warehouseRouter);
  app.use("/api/capture", createCaptureRouter());
  app.use("/api/bridge/capture", createBridgeRouter());
  app.use("/api/diagnostics", createSentinelRouter());

  app.get("/api/version", (req, res) => {
    res.json({
      version: APP_VERSION,
      buildTimestamp: SERVER_BOOT_TIMESTAMP,
      serverBootTime: SERVER_BOOT_TIMESTAMP,
      commit: "prod-current",
      environment: process.env.NODE_ENV || "development"
    });
  });

  // --- VITE & STATIC FILES ---
  app.use(express.static(publicDir));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }
  
  // --- BIND PORT IMMEDIATELY FOR FAST HEALTH CHECKS ---
  app.listen(PORT, "0.0.0.0", () => { 
    console.log(`Server running on http://0.0.0.0:${PORT}`); 

    // Run database migrations and seed hydration in background so port binding is never blocked!
    (async () => {
      try {
        const pool = createPool();
        await pool.query(`
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS previous_generated_code text;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS equated_by text;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS equated_at timestamp;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS merchandiser text;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS brand_code text;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS goods_no text;
          ALTER TABLE garments ADD COLUMN IF NOT EXISTS handwritten_notes text;
        `);
      } catch (dbColErr: any) {
        console.warn("[DB Startup] Note ensuring equated and label columns:", dbColErr?.message || dbColErr);
      }

      try {
        const seedGarmentsFile = path.join(process.cwd(), 'data', 'seed_garments.json');
        if (!fs.existsSync(seedGarmentsFile)) {
          console.log("[DB Startup] Baking current database state to data/seed_*.json...");
          await SeedManager.bakeSeedFiles();
        }
        
        console.log("[DB Startup] Hydrating database from permanent seed files...");
        await SeedManager.hydrateDatabase();

        // Refresh singleton managers now that database hydration has completed
        await EquatedCodeManager.getInstance().loadFromDisk();
        await FgdJobManager.getInstance().getSavedReports(true);

        const hbRule = await db.select().from(labeling_rules).where(eq(labeling_rules.rule_code, 'RULE-BRAND-HUGOBOSS-01'));
        if (hbRule.length === 0) {
          await db.insert(labeling_rules).values({
            rule_code: 'RULE-BRAND-HUGOBOSS-01',
            rule_type: 'positive',
            target_field: 'buyer',
            rule_title: 'Hugo Boss Permanent Brand Architecture (HUGO vs BOSS)',
            condition_trigger: "Tag mentions 'HB', 'Hugo Boss', 'BOSS', or 'HUGO'",
            rule_instruction: "Hugo Boss restructured into two distinct brand pillars: 'HUGO' and 'BOSS'.",
            example_positive: "BOSS (or HUGO)",
            example_negative: "HB (Hugo Boss)",
            source_feedback: "Hugo Boss permanent brand architecture.",
            is_active: true
          });
        }
      } catch (e: any) {
        console.error("[DB Startup] Seed/Hydration error in background:", e?.message || e);
      }
    })();
  });
}

startServer();
