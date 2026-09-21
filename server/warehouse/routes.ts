import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { warehouseFacade } from './WarehouseFacade';
import { warehouseLogicDb } from './warehouseLogicDb';
import { topologyEngine } from './engine/TopologyEngine';
import { db } from '../../src/db/index.ts';
import { garments } from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { locationDao } from './dao/LocationDAO';
import { CaptureTriageManager } from '../services/CaptureTriageManager.ts';

const router = express.Router();

// Middleware to secure /builder routes to 'jason' only
const requireDeveloper = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userRole = req.headers['x-user-role'] || req.query.user || req.body.user;
  if (userRole !== 'jason' && userRole !== 'developer') {
    return res.status(403).json({ error: 'Forbidden: Only developer (jason) can modify warehouse layout.' });
  }
  next();
};

router.use('/builder', requireDeveloper);

// Static serving of batch evidence & inspection photos
const evidenceDir = path.join(process.cwd(), 'uploads', 'warehouse_batches');
const inspectionsDir = path.join(process.cwd(), 'uploads', 'warehouse_inspections');

[evidenceDir, inspectionsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
});

router.get('/evidence/:filename', (req, res) => {
  const file = path.join(evidenceDir, path.basename(req.params.filename));
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send('Not found');
  }
});

router.get('/inspections/:filename', (req, res) => {
  const file = path.join(inspectionsDir, path.basename(req.params.filename));
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send('Not found');
  }
});

// GET warehouse locations with optional area / cabinet / buyer filters
router.get('/locations', async (req, res) => {
  try {
    const { area, cabinetNo, buyer, isFull } = req.query;
    const filter = {
      area: area ? String(area) : undefined,
      cabinetNo: cabinetNo ? String(cabinetNo) : undefined,
      buyer: buyer ? String(buyer) : undefined,
      isFull: isFull !== undefined ? isFull === 'true' || isFull === '1' : undefined
    };
    const locations = await warehouseFacade.getLocations(filter);
    res.json({ success: true, count: locations.length, locations });
  } catch (err: any) {
    console.error('Error fetching warehouse locations:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch locations' });
  }
});

// POST initialize / build a single rolling cabinet (lean summary payload)
router.post('/builder/init-cabinet', async (req, res) => {
  try {
    const rawCabinet = String(req.body.cabinetNo || 'A3').trim().toUpperCase();
    const defaults = topologyEngine.getDefaultCabinetConfig(rawCabinet);
    const cabinetNo = rawCabinet;
    const shelvesCount = req.body.shelvesCount !== undefined ? Number(req.body.shelvesCount) : defaults.shelvesCount;
    const stacksPerShelf = req.body.stacksPerShelf !== undefined ? Number(req.body.stacksPerShelf) : defaults.stacksPerShelf;
    const preset = (req.body.preset || defaults.preset) as 'HUGO_BOSS_STANDARD' | 'CUSTOM' | 'UNPARTITIONED';

    const locations = await warehouseFacade.buildCabinet({
      cabinetNo,
      shelvesCount,
      stacksPerShelf,
      preset
    });
    // Returns concise summary; only returns heavy array if explicitly asked via ?includeLocations=true
    const includeLocations = req.query.includeLocations === 'true';
    res.json({ 
      success: true, 
      message: `Rolling Cabinet ${cabinetNo} built successfully with ${locations.length} stacks.`, 
      cabinetNo: String(cabinetNo).trim().toUpperCase(),
      count: locations.length,
      ...(includeLocations ? { locations } : {})
    });
  } catch (err: any) {
    console.error('Error building cabinet:', err);
    res.status(500).json({ error: err.message || 'Failed to build cabinet' });
  }
});

// POST initialize an entire Area (e.g. Area A = 11 cabinets, Area B = 10 cabinets, etc.)
router.post('/builder/init-bulk-area', async (req, res) => {
  try {
    const { areaCode, closeStack5InB = false } = req.body;
    if (!areaCode) {
      return res.status(400).json({ error: 'areaCode is required (A, B, C, D, E, or F)' });
    }
    const cleanArea = String(areaCode).trim().toUpperCase();
    const locations = await warehouseFacade.buildArea(cleanArea, Boolean(closeStack5InB));
    
    // Returns concise metadata summary to avoid megabytes of network overhead
    res.json({
      success: true,
      message: `Area ${cleanArea} initialized successfully with ${locations.length} stack locations.`,
      area: cleanArea,
      locationsGenerated: locations.length,
      sampleLocationCodes: locations.slice(0, 3).map(l => l.location_code)
    });
  } catch (err: any) {
    console.error('Error building bulk area:', err);
    res.status(500).json({ error: err.message || 'Failed to build bulk area' });
  }
});

// POST initialize all 6 Areas (A through F) in one quick batch
router.post('/builder/init-all-areas', async (req, res) => {
  try {
    const { closeStack5InB = false } = req.body;
    const areas = ['A', 'B', 'C', 'D', 'E', 'F'];
    const summary: Record<string, number> = {};
    let totalLocations = 0;

    for (const area of areas) {
      const locs = await warehouseFacade.buildArea(area, Boolean(closeStack5InB));
      summary[area] = locs.length;
      totalLocations += locs.length;
    }

    res.json({
      success: true,
      message: `All 6 Areas (A-F) initialized with ${totalLocations} total stack locations.`,
      totalLocations,
      areaBreakdown: summary
    });
  } catch (err: any) {
    console.error('Error building all areas:', err);
    res.status(500).json({ error: err.message || 'Failed to build all areas' });
  }
});

// POST toggle Stack 5 state (Open / Close) for Area B cabinets/shelves
router.post('/builder/toggle-stack5', async (req, res) => {
  try {
    const { cabinetNo, shelfNo, close } = req.body;
    const result = await warehouseFacade.toggleStack5({
      cabinetNo: cabinetNo ? String(cabinetNo).trim().toUpperCase() : undefined,
      shelfNo: shelfNo !== undefined && shelfNo !== null ? Number(shelfNo) : undefined,
      close: Boolean(close)
    });
    res.json({
      success: true,
      message: `Stack 5 ${close ? 'closed' : 'opened'} successfully`,
      ...result
    });
  } catch (err: any) {
    console.error('Error toggling stack 5:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle stack 5' });
  }
});

// POST assign space to a garment
router.post('/assign-next', async (req, res) => {
  try {
    const assignment = await warehouseFacade.assignSpace(req.body);
    res.json({ success: true, assignment });
  } catch (err: any) {
    console.error('Error assigning location:', err);
    res.status(500).json({ error: err.message || 'Failed to assign location' });
  }
});

// POST shelve a batch of garments
router.post('/shelve-batch', async (req, res) => {
  try {
    const { batchName, garments } = req.body;
    const result = await warehouseFacade.shelveBatch(batchName, garments);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error shelving batch:', err);
    res.status(500).json({ error: err.message || 'Failed to shelve batch' });
  }
});

// GET all batches
router.get('/batches', async (req, res) => {
  try {
    const batches = await warehouseFacade.getBatches();
    res.json({ success: true, batches });
  } catch (err: any) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch batches' });
  }
});

// Update location mode
router.put('/locations/:code/mode', async (req, res) => {
  try {
    const { code } = req.params;
    const { assignmentMode } = req.body;
    
    if (assignmentMode !== 'Manual' && assignmentMode !== 'Auto') {
      return res.status(400).json({ error: 'Invalid assignment mode. Must be Manual or Auto.' });
    }

    const updated = await locationDao.updateByCode(code, { assignment_mode: assignmentMode });
    if (!updated) {
      return res.status(404).json({ error: `Location ${code} not found.` });
    }
    
    res.json({ success: true, location: updated });
  } catch (err: any) {
    console.error('Error updating location mode:', err);
    res.status(500).json({ error: err.message || 'Failed to update location mode' });
  }
});

// Fallback stubs for backward compatibility
router.get('/unshelfed', (req, res) => res.json({ success: true, totalCount: 0, garments: [], tempContainers: [] }));
router.put('/locations/:code', (req, res) => res.json({ success: true }));
router.post('/rearrange', (req, res) => res.json({ success: true }));
router.post('/inspect-stack-fullness', (req, res) => res.json({ success: true }));

// POST assign space manually with logic logs
router.post('/assign-manual', async (req, res) => {
  try {
    const { garmentId, locationCode, logicText, assignedBy } = req.body;
    if (!garmentId || !locationCode) {
      return res.status(400).json({ error: 'garmentId and locationCode are required' });
    }

    const triageManager = CaptureTriageManager.getInstance();
    if (triageManager.isQuarantined(garmentId)) {
      return res.status(400).json({ error: `Quarantine Isolation: Garment ${garmentId} is quarantined (Set B / REJECTED_NO_GARMENT) and cannot be assigned warehouse space.` });
    }
    const gCheck = await db.select().from(garments).where(eq(garments.id, garmentId));
    if (gCheck.length > 0 && gCheck[0].status === 'quarantined') {
      return res.status(400).json({ error: `Quarantine Isolation: Garment ${garmentId} is quarantined (Set B / REJECTED_NO_GARMENT) and cannot be assigned warehouse space.` });
    }

    // 1. Update Garment in PostgreSQL
    await db.update(garments)
      .set({ 
        assigned_location: locationCode,
        location: locationCode,
        shelving_status: 'shelved',
        shelved_at: new Date(),
        shelved_by: assignedBy || 'Jennifer'
      })
      .where(eq(garments.id, garmentId));

    // 2. Increment physical count in Warehouse Store
    const loc = await locationDao.findByCode(locationCode);
    if (!loc) {
      return res.status(404).json({ error: `Location ${locationCode} not found in physical warehouse` });
    }
    await locationDao.incrementGarmentCount(locationCode, 1);

    // 3. Save Organisation Logic Log
    if (logicText) {
      await warehouseLogicDb.addLog({
        garment_id: garmentId,
        location_code: locationCode,
        logic_text: logicText,
        assigned_by: assignedBy || 'Jennifer'
      });
    }

    res.json({ success: true, message: 'Garment assigned and logic logged' });
  } catch (err: any) {
    console.error('Error in manual assignment:', err);
    res.status(500).json({ error: err.message || 'Failed to manually assign garment' });
  }
});

// POST global logic
router.post('/global-logic', async (req, res) => {
  try {
    const { logicText, assignedBy } = req.body;
    if (!logicText) {
      return res.status(400).json({ error: 'logicText is required' });
    }
    
    await warehouseLogicDb.updateGlobalLogic(logicText, assignedBy || 'Jennifer');
    
    res.json({ success: true, message: 'Global logic saved successfully' });
  } catch (err: any) {
    console.error('Error saving global logic:', err);
    res.status(500).json({ error: err.message || 'Failed to save global logic' });
  }
});

// POST digest logic to rules
router.post('/rules/digest', async (req, res) => {
  try {
    const logs = await warehouseLogicDb.getLogs();
    const globalLogic = await warehouseLogicDb.getGlobalLogic();
    
    if (logs.length === 0 && !globalLogic) {
      return res.status(400).json({ error: 'No logic logs or global logic to digest.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const promptText = `
You are a warehouse management AI for Winzen Sample Library.
Your job is to read plain-language feedback from merchandisers and translate it into structured placement rules.

Data Source 1: Global Organisation Logic
${globalLogic ? globalLogic.logic_text : 'None'}

Data Source 2: Manual Organisation Logic Logs (Recent Garment placements)
${logs.map(log => `Garment ${log.garment_id} -> ${log.location_code} | Reason: ${log.logic_text}`).join('\n')}

Based on this input, extract a list of 1 to 5 structured rules for future location assignment.
Each rule must have:
- rule_code: A short uppercase string (e.g., 'HEAVY_KNITWEAR_AREA_B', 'HUGO_RIGHT_SIDE')
- target_location: The destination area, cabinet, or shelf description (e.g. 'Area B', 'Shelves 6-10')
- condition_trigger: When does this rule apply? (e.g. 'Garment has #heavy-knitwear', 'Buyer is Hugo')
- positive_examples: A list of 2 example garment types that fit.
- negative_examples: A list of 2 example garment types that do not fit.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rule_code: { type: Type.STRING },
                  target_location: { type: Type.STRING },
                  condition_trigger: { type: Type.STRING },
                  positive_examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                  negative_examples: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['rule_code', 'target_location', 'condition_trigger', 'positive_examples', 'negative_examples']
              }
            }
          },
          required: ['rules']
        }
      }
    });

    const resultText = response.text || '';
    const structuredRules = JSON.parse(resultText);

    res.json({ success: true, rules: structuredRules.rules });
  } catch (err: any) {
    console.error('Error digesting rules:', err);
    res.status(500).json({ error: err.message || 'Failed to digest rules' });
  }
});

export default router;
