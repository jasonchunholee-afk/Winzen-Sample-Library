import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import * as archiverModule from 'archiver';
import { db } from '../../src/db/index.ts';
import { garments, images } from '../../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { parseWinzenFilename, ImageTier, groupFilesByGarment, ParsedWinzenImage } from '../services/WinzenCaptureParser.ts';
import { EquatedCodeManager } from '../services/EquatedCodeManager.ts';
import { SeedManager } from '../services/SeedManager.ts';
import { CaptureAiInspector } from '../services/CaptureAiInspector.ts';
import { CaptureTriageManager } from '../services/CaptureTriageManager.ts';

export function createCaptureRouter(): Router {
  const router = Router();
  const equatedCodeManager = EquatedCodeManager.getInstance();
  const captureAiInspector = CaptureAiInspector.getInstance();
  const triageManager = CaptureTriageManager.getInstance();

  // Root storage directories for the 3 tiers
  const PUBLIC_DIR = path.join(process.cwd(), 'public');
  const RAW_DIR = path.join(PUBLIC_DIR, 'images');
  const AI_DIR = path.join(PUBLIC_DIR, 'images_ai');
  const THUMB_DIR = path.join(PUBLIC_DIR, 'images_thumb');

  // Ensure directories exist
  [RAW_DIR, AI_DIR, THUMB_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Multer config for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB per file
  });

  function getTierDir(tier: ImageTier): string {
    switch (tier) {
      case 'ai': return AI_DIR;
      case 'thumb': return THUMB_DIR;
      case 'raw':
      default: return RAW_DIR;
    }
  }

  // --------------------------------------------------------------------------
  // 1. POST /api/capture/sync-diff
  // Compares client manifest with server filesystem and database
  // --------------------------------------------------------------------------
  router.post('/sync-diff', async (req: Request, res: Response) => {
    try {
      const clientManifest: Array<{
        filename: string;
        garmentId?: string;
        tier?: ImageTier;
        size?: number;
        mtime?: number | string;
      }> = req.body.clientManifest || [];

      // Read current server files across the 3 tiers
      const serverRaw = fs.readdirSync(RAW_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
      const serverAi = fs.readdirSync(AI_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
      const serverThumb = fs.readdirSync(THUMB_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));

      const serverAllFiles = new Set([...serverRaw, ...serverAi, ...serverThumb]);
      const clientFilesMap = new Map<string, { filename: string; garmentId?: string; tier?: ImageTier }>();
      
      for (const item of clientManifest) {
        clientFilesMap.set(item.filename, item);
      }

      // 1. Calculate toUpload (client has, server missing)
      const toUpload: Array<{
        filename: string;
        garmentId: string;
        role: string;
        isSticker: boolean;
        isUntagged: boolean;
        missingTiers: ImageTier[];
      }> = [];

      for (const [filename, item] of clientFilesMap.entries()) {
        const parsed = parseWinzenFilename(filename);
        const missingTiers: ImageTier[] = [];

        if (!serverRaw.includes(filename)) missingTiers.push('raw');
        if (!serverAi.includes(filename)) missingTiers.push('ai');
        if (!serverThumb.includes(filename)) missingTiers.push('thumb');

        if (missingTiers.length > 0) {
          toUpload.push({
            filename,
            garmentId: parsed?.garmentId || item.garmentId || 'UNKNOWN',
            role: parsed?.role || 'Detail',
            isSticker: parsed?.isSticker || false,
            isUntagged: parsed?.isUntagged || false,
            missingTiers
          });
        }
      }

      // 2. Calculate toDownload (server has, client missing)
      const toDownload: Array<{
        filename: string;
        garmentId: string;
        role: string;
        availableTiers: ImageTier[];
        url: string;
      }> = [];

      for (const filename of serverAllFiles) {
        if (!clientFilesMap.has(filename)) {
          const parsed = parseWinzenFilename(filename);
          const availableTiers: ImageTier[] = [];
          if (serverRaw.includes(filename)) availableTiers.push('raw');
          if (serverAi.includes(filename)) availableTiers.push('ai');
          if (serverThumb.includes(filename)) availableTiers.push('thumb');

          toDownload.push({
            filename,
            garmentId: parsed?.garmentId || 'UNKNOWN',
            role: parsed?.role || 'Detail',
            availableTiers,
            url: availableTiers.includes('thumb') ? `/thumb/${filename}` : `/raw/${filename}`
          });
        }
      }

      // 3. Sticker codes detected for equate tracking
      const stickerCodes = toUpload.filter(f => f.isSticker).map(f => f.garmentId);
      const uniqueStickers = Array.from(new Set(stickerCodes));

      res.json({
        success: true,
        summary: {
          clientFileCount: clientManifest.length,
          serverRawCount: serverRaw.length,
          serverAiCount: serverAi.length,
          serverThumbCount: serverThumb.length,
          toUploadCount: toUpload.length,
          toDownloadCount: toDownload.length,
          stickersDetected: uniqueStickers.length
        },
        toUpload,
        toDownload,
        stickersDetected: uniqueStickers
      });
    } catch (err: any) {
      console.error('[CaptureSyncDiff Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to compute sync diff' });
    }
  });

  // --------------------------------------------------------------------------
  // 2. POST /api/capture/up-sync
  // Multipart or JSON batch ingestion of files into 3-tier architecture + PG
  // --------------------------------------------------------------------------
  router.post('/up-sync', upload.array('files'), async (req: Request, res: Response) => {
    try {
      const uploadedFiles = req.files as Express.Multer.File[] || [];
      let jsonBatch = req.body.batch ? (typeof req.body.batch === 'string' ? JSON.parse(req.body.batch) : req.body.batch) : null;
      if (!jsonBatch && (req.body.files || req.body.items)) {
        jsonBatch = { files: req.body.files || req.body.items };
      }
      const targetTier = (req.body.tier as ImageTier) || 'raw';

      const results: Array<{ filename: string; garmentId: string; role: string; tiersStored: ImageTier[]; success: boolean; error?: string; triage?: any }> = [];
      let garmentsCreated = 0;
      let imagesRegistered = 0;

      // Combine multipart files and JSON files if provided
      interface ProcessingItem {
        filename: string;
        buffer: Buffer;
        specifiedTier?: ImageTier;
        garmentId?: string;
        role?: string;
      }

      const itemsToProcess: ProcessingItem[] = [];

      for (const f of uploadedFiles) {
        itemsToProcess.push({
          filename: f.originalname,
          buffer: f.buffer,
          specifiedTier: targetTier
        });
      }

      if (jsonBatch && Array.isArray(jsonBatch.files)) {
        for (const jf of jsonBatch.files) {
          if (jf.filename && jf.base64) {
            const cleanBase64 = jf.base64.replace(/^data:image\/\w+;base64,/, '');
            itemsToProcess.push({
              filename: jf.filename,
              buffer: Buffer.from(cleanBase64, 'base64'),
              specifiedTier: jf.tier || targetTier,
              garmentId: jf.garmentId,
              role: jf.role
            });
          }
        }
      }

      for (const item of itemsToProcess) {
        try {
          const parsed = parseWinzenFilename(item.filename);
          const garmentId = item.garmentId || parsed?.garmentId || 'UNKNOWN';
          const role = item.role || parsed?.role || 'Detail';
          const tiersStored: ImageTier[] = [];

          // 1. Write the primary buffer to its specified tier
          const tierDir = getTierDir(item.specifiedTier || 'raw');
          const destPath = path.join(tierDir, item.filename);
          fs.writeFileSync(destPath, item.buffer);
          tiersStored.push(item.specifiedTier || 'raw');

          // 2. Generate derivative tiers if missing (e.g. if uploaded raw, generate ai and thumb)
          if ((item.specifiedTier || 'raw') === 'raw') {
            const aiDest = path.join(AI_DIR, item.filename);
            const thumbDest = path.join(THUMB_DIR, item.filename);

            try {
              // Generate AI tier: 1024px max, JPEG Q85
              await sharp(item.buffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toFile(aiDest);
              tiersStored.push('ai');
            } catch (aiErr) {
              console.warn(`[Up-sync] AI tier generation warning for ${item.filename}:`, aiErr);
            }

            try {
              // Generate Thumb tier: 400px max, JPEG Q80
              await sharp(item.buffer)
                .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(thumbDest);
              tiersStored.push('thumb');
            } catch (thumbErr) {
              console.warn(`[Up-sync] Thumb tier generation warning for ${item.filename}:`, thumbErr);
            }
          }

          // 3. Automated Quality Gate in CaptureAiInspector (using lightweight 1024px ai/ tier)
          const triage = await captureAiInspector.triageCaptureShot(item.filename, item.buffer, garmentId);
          await triageManager.recordTriage(triage);

          const isQuarantined = triage.setClassification === 'Set B' || triage.status === 'quarantined';
          const assignedRole = isQuarantined ? 'Quarantined: REJECTED_NO_GARMENT' : role;

          // 4. PostgreSQL Harmonization: Garments
          if (garmentId && garmentId !== 'UNKNOWN') {
            const existingGarment = await db.select().from(garments).where(eq(garments.id, garmentId));

            if (isQuarantined) {
              // Set B (Poor/Empty Shot): Quarantine isolation - keep out of catalog & active inventory
              if (existingGarment.length === 0) {
                await db.insert(garments).values({
                  id: garmentId,
                  status: 'quarantined',
                  sample_stage: 'Quarantined',
                  reviewer_feedback: 'REJECTED_NO_GARMENT',
                  remark_memo: `[AI Quality Gate: Set B Quarantined] Confidence: ${triage.confidence}% - ${triage.details}`,
                  structural_feedback: JSON.stringify(triage),
                  description: `Quarantined shot (${triage.rejectionReason}) - ${new Date().toLocaleDateString()}`
                });
                garmentsCreated++;
              } else if (existingGarment[0].status !== 'Approved') {
                await db.update(garments).set({
                  status: 'quarantined',
                  sample_stage: 'Quarantined',
                  reviewer_feedback: 'REJECTED_NO_GARMENT',
                  remark_memo: `[AI Quality Gate: Set B Quarantined] Confidence: ${triage.confidence}% - ${triage.details}`,
                  structural_feedback: JSON.stringify(triage)
                }).where(eq(garments.id, garmentId));
              }
            } else {
              // Set A (Valid Garment / Tag): active, queued for FGD OCR
              if (existingGarment.length === 0) {
                await db.insert(garments).values({
                  id: garmentId,
                  status: 'Draft',
                  sample_stage: parsed?.isSticker ? 'Sticker Unlinked' : 'Queued for FGD OCR',
                  brand: '',
                  buyer: '',
                  remark_memo: `[AI Quality Gate: Set A Valid Garment] Confidence: ${triage.confidence}% - ${triage.details}`,
                  description: `Ingested from Winzen Capture Station (${new Date().toLocaleDateString()})`
                });
                garmentsCreated++;
              } else if (existingGarment[0].status === 'quarantined') {
                // If previously provisional quarantined, upgrade to active Draft upon receiving a valid shot
                await db.update(garments).set({
                  status: 'Draft',
                  sample_stage: 'Queued for FGD OCR',
                  reviewer_feedback: 'Valid Set A shot ingested; released to active review'
                }).where(eq(garments.id, garmentId));
              }
            }

            // 5. PostgreSQL Harmonization: Images
            const existingImage = await db.select().from(images).where(
              and(eq(images.garment_id, garmentId), eq(images.filename, item.filename))
            );

            if (existingImage.length === 0) {
              await db.insert(images).values({
                garment_id: garmentId,
                role: assignedRole,
                filename: item.filename
              });
              imagesRegistered++;
            } else {
              await db.update(images).set({
                role: assignedRole
              }).where(and(eq(images.garment_id, garmentId), eq(images.filename, item.filename)));
            }

            // 6. Automated Equate Trigger:
            // For Set A files starting with WZ-*, automatically inspect MACRO_1 to detect handwriting or attached care cards
            if (!isQuarantined && (parsed?.isSticker || garmentId.startsWith('WZ-'))) {
              if (parsed?.cameraSuffix === 'MACRO_1' || role === 'Label') {
                try {
                  const macroResult = await captureAiInspector.inspectMacroCareCardAndHandwriting(
                    item.filename,
                    item.buffer,
                    garmentId
                  );

                  const correctedCode = macroResult.detectedStyleNo || '';
                  const notes = macroResult.careDetails || macroResult.explanation || `Captured via ${parsed?.cameraSuffix || 'MACRO_1'}`;

                  await equatedCodeManager.equateCode({
                    previous_code: garmentId,
                    corrected_code: correctedCode,
                    equated_by: 'Winzen Capture Quality Gate (MACRO_1 Care Card)',
                    equated_at: new Date().toISOString(),
                    reference_notes: `Auto-linked from MACRO_1 care card inspection. ${notes}`,
                    previous_garment_type: correctedCode ? 'sticker_linked' : 'sticker_unlinked'
                  });

                  if (correctedCode) {
                    await db.update(garments).set({
                      cust_style_no: correctedCode,
                      handwritten_notes: `Sticker Code: ${macroResult.handwrittenCode || garmentId}`,
                      content_notes: notes
                    }).where(eq(garments.id, garmentId));
                  }
                } catch (macroErr) {
                  console.warn(`[Up-sync] Warning inspecting MACRO_1 care card for ${garmentId}:`, macroErr);
                  await equatedCodeManager.equateCode({
                    previous_code: garmentId,
                    corrected_code: '',
                    equated_by: 'Winzen Capture Station',
                    equated_at: new Date().toISOString(),
                    reference_notes: `Missing Label Sticker Code. Captured via ${parsed?.cameraSuffix || 'MACRO_1'}`,
                    previous_garment_type: 'sticker_unlinked'
                  });
                }
              } else {
                await equatedCodeManager.equateCode({
                  previous_code: garmentId,
                  corrected_code: '',
                  equated_by: 'Winzen Capture Station',
                  equated_at: new Date().toISOString(),
                  reference_notes: `Missing Label Sticker Code. Captured via ${parsed?.cameraSuffix || 'TOP'}`,
                  previous_garment_type: 'sticker_unlinked'
                });
              }
            }
          }

          results.push({
            filename: item.filename,
            garmentId,
            role: assignedRole,
            tiersStored,
            triage: {
              setClassification: triage.setClassification,
              status: triage.status,
              rejectionReason: triage.rejectionReason,
              confidence: triage.confidence,
              details: triage.details
            },
            success: true
          });
        } catch (fileErr: any) {
          console.error(`[Up-sync] Error processing ${item.filename}:`, fileErr);
          results.push({
            filename: item.filename,
            garmentId: 'ERROR',
            role: 'Detail',
            tiersStored: [],
            success: false,
            error: fileErr?.message || String(fileErr)
          });
        }
      }

      // Background Seed Sync to ensure durable persistence on disk
      SeedManager.bakeSeedFiles().catch(err => {
        console.warn('[Up-sync] Note non-blocking seed bake:', err);
      });

      res.json({
        success: true,
        processedCount: itemsToProcess.length,
        garmentsCreated,
        imagesRegistered,
        results
      });
    } catch (err: any) {
      console.error('[Capture Up-sync Error]:', err);
      res.status(500).json({ error: err.message || 'Up-sync failed' });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/capture/down-sync-manifest
  // Returns complete catalogue of server images across the 3 tiers
  // --------------------------------------------------------------------------
  router.get('/down-sync-manifest', async (req: Request, res: Response) => {
    try {
      const serverRaw = fs.readdirSync(RAW_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
      const serverAi = fs.readdirSync(AI_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
      const serverThumb = fs.readdirSync(THUMB_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));

      const allFiles = Array.from(new Set([...serverRaw, ...serverAi, ...serverThumb]));

      const manifest = allFiles.map(filename => {
        const parsed = parseWinzenFilename(filename);
        const rawPath = path.join(RAW_DIR, filename);
        let size = 0;
        let mtime = 0;

        if (fs.existsSync(rawPath)) {
          const stat = fs.statSync(rawPath);
          size = stat.size;
          mtime = stat.mtimeMs;
        }

        return {
          filename,
          garmentId: parsed?.garmentId || 'UNKNOWN',
          role: parsed?.role || 'Detail',
          cameraSuffix: parsed?.cameraSuffix || '',
          timestamp: parsed?.timestamp || '',
          isSticker: parsed?.isSticker || false,
          isUntagged: parsed?.isUntagged || false,
          tiers: {
            raw: serverRaw.includes(filename),
            ai: serverAi.includes(filename),
            thumb: serverThumb.includes(filename)
          },
          size,
          mtime,
          urls: {
            raw: `/raw/${filename}`,
            ai: `/ai/${filename}`,
            thumb: `/thumb/${filename}`
          }
        };
      });

      res.json({
        success: true,
        count: manifest.length,
        manifest
      });
    } catch (err: any) {
      console.error('[Down-sync Manifest Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to generate down-sync manifest' });
    }
  });

  // --------------------------------------------------------------------------
  // 4. GET /api/capture/download-image
  // Streams an individual tier image to the client
  // --------------------------------------------------------------------------
  router.get('/download-image', (req: Request, res: Response) => {
    const filename = req.query.filename as string;
    const tier = (req.query.tier as ImageTier) || 'ai';

    if (!filename) {
      return res.status(400).json({ error: 'filename query parameter is required' });
    }

    const cleanFilename = path.basename(filename);
    const tierDir = getTierDir(tier);
    const filePath = path.join(tierDir, cleanFilename);

    if (!fs.existsSync(filePath)) {
      // Fallback to raw if requested tier does not exist
      const fallbackPath = path.join(RAW_DIR, cleanFilename);
      if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
      }
      return res.status(404).json({ error: `Image ${cleanFilename} not found on server` });
    }

    res.sendFile(filePath);
  });

  // --------------------------------------------------------------------------
  // 5. GET /api/capture/down-sync-zip
  // Streams a zip archive of requested images/tiers
  // --------------------------------------------------------------------------
  router.get('/down-sync-zip', async (req: Request, res: Response) => {
    try {
      const requestedTier = (req.query.tier as string) || 'all';
      const garmentId = req.query.garmentId as string;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=winzen-capture-sync-${requestedTier}-${Date.now()}.zip`);

      let archive: any;
      if (typeof (archiverModule as any).ZipArchive === 'function') {
        archive = new (archiverModule as any).ZipArchive({ zlib: { level: 6 } });
      } else if (typeof (archiverModule as any).default === 'function') {
        archive = (archiverModule as any).default('zip', { zlib: { level: 6 } });
      } else {
        archive = (archiverModule as any)('zip', { zlib: { level: 6 } });
      }
      archive.pipe(res);

      const serverRaw = fs.readdirSync(RAW_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));

      for (const filename of serverRaw) {
        const parsed = parseWinzenFilename(filename);
        if (garmentId && parsed?.garmentId !== garmentId) {
          continue;
        }

        if (requestedTier === 'all' || requestedTier === 'raw') {
          const rawFile = path.join(RAW_DIR, filename);
          if (fs.existsSync(rawFile)) {
            archive.file(rawFile, { name: `raw/${filename}` });
          }
        }

        if (requestedTier === 'all' || requestedTier === 'ai') {
          const aiFile = path.join(AI_DIR, filename);
          if (fs.existsSync(aiFile)) {
            archive.file(aiFile, { name: `ai/${filename}` });
          }
        }

        if (requestedTier === 'all' || requestedTier === 'thumb') {
          const thumbFile = path.join(THUMB_DIR, filename);
          if (fs.existsSync(thumbFile)) {
            archive.file(thumbFile, { name: `thumb/${filename}` });
          }
        }
      }

      await archive.finalize();
    } catch (err: any) {
      console.error('[Down-sync Zip Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to generate zip archive' });
      }
    }
  });

  /**
   * GET /api/capture/quarantine:
   * Fetch all quarantined items with reasons, confidence scores, and preview URLs
   */
  router.get('/quarantine', async (req: Request, res: Response) => {
    try {
      const quarantined = triageManager.getQuarantined();
      const enriched = quarantined.map(q => ({
        ...q,
        thumbUrl: `/images_thumb/${q.filename}`,
        aiUrl: `/images_ai/${q.filename}`,
        rawUrl: `/images/${q.filename}`
      }));
      res.json({
        success: true,
        count: enriched.length,
        quarantined: enriched
      });
    } catch (err: any) {
      console.error('[Quarantine API Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch quarantine list' });
    }
  });

  /**
   * POST /api/capture/quarantine/release:
   * Manual override / release from quarantine
   */
  router.post('/quarantine/release', async (req: Request, res: Response) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'filename is required' });
      }
      const released = await triageManager.releaseQuarantine(filename);
      if (!released) {
        return res.status(404).json({ error: `Record for ${filename} not found in quarantine` });
      }

      // Update image role to 'Front' or 'Detail' instead of Quarantined
      await db.update(images).set({
        role: 'Detail'
      }).where(eq(images.filename, filename));

      res.json({
        success: true,
        message: `Image ${filename} released from quarantine into active review`
      });
    } catch (err: any) {
      console.error('[Quarantine Release Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to release item from quarantine' });
    }
  });

  /**
   * POST /api/capture/quarantine/discard:
   * Operator permanently discards a Set B quarantined frame
   */
  router.post('/quarantine/discard', async (req: Request, res: Response) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'filename is required' });
      }
      await triageManager.discardQuarantine(filename);
      // Remove from disk if present
      for (const dir of [RAW_DIR, AI_DIR, THUMB_DIR]) {
        const p = path.join(dir, path.basename(filename));
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch {}
        }
      }
      res.json({
        success: true,
        message: `Image ${filename} permanently discarded`
      });
    } catch (err: any) {
      console.error('[Quarantine Discard Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to discard quarantined item' });
    }
  });

  /**
   * POST /api/capture/triage-single:
   * On-demand automated quality gate inspection for an image file
   */
  router.post('/triage-single', async (req: Request, res: Response) => {
    try {
      const { filename, garmentId } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'filename is required' });
      }
      const triage = await captureAiInspector.triageCaptureShot(filename, undefined, garmentId);
      await triageManager.recordTriage(triage);
      res.json({ success: true, triage });
    } catch (err: any) {
      console.error('[Triage Single Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to triage image' });
    }
  });

  return router;
}
