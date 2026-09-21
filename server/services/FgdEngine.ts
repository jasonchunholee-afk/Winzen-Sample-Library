import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { db } from '../../src/db/index.ts';
import { garments, labeling_rules, abbreviation_library, summaries, images } from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';

export interface FgdLabelData {
  buyer?: string;
  brand_code?: string;
  season?: string;
  sales?: string;
  merchandiser?: string;
  cust_style_no?: string;
  y_style_no?: string;
  winzen_style_no?: string;
  sample_job_no?: string;
  goods_no?: string;
  sample_stage?: string;
  garment_type?: string;
  washing?: string;
  fabric_raw?: string;
  fabric_material?: string;
  fabric_yarn_count?: string;
  fabric_construction?: string;
  color?: string;
  size?: string;
  gnw_weight?: string;
  remark_memo?: string;
  handwritten_notes?: string;
}

export interface FgdData {
  label: FgdLabelData;
  garment_description: string;
  hashtags: string[];
}

export interface FgdDiffItem {
  category: 'Label' | 'Garment Description' | 'Hashtags';
  field?: string;
  original: string;
  fresh: string;
  analysis: string;
}

export interface RuleAmendment {
  rule_code: string;
  rule_type: 'positive' | 'negative';
  target_field: string;
  rule_title: string;
  condition_trigger: string;
  rule_instruction: string;
  example_positive?: string;
  example_negative?: string;
  source_feedback: string;
  user_comment?: string;
}

export interface DiscrepancyReviewQuestion {
  field?: string;
  category: string;
  discrepancy: string;
  question: string;
}

export interface LoopResult {
  loop_number: number;
  fresh_fgd: FgdData;
  differences: FgdDiffItem[];
  bulletpoints: string[];
  amended_rules: RuleAmendment[];
  review_questions?: DiscrepancyReviewQuestion[];
  score: number; // Out of 10
  score_breakdown: {
    label_accuracy: number;        // out of 4.0
    description_fidelity: number;  // out of 4.0
    hashtag_coverage: number;      // out of 2.0
  };
  evaluation_summary: string;
}

export interface GarmentTestReport {
  garment_id: string;
  tested_at: string;
  images_processed: string[];
  original_fgd: FgdData;
  loops: LoopResult[];
  final_score: number;
  final_verdict: string;
  cumulative_rule_amendments: RuleAmendment[];
  review_questions?: DiscrepancyReviewQuestion[];
  is_review_run?: boolean;
}

export interface GarmentTestOptions {
  isReviewRun?: boolean;
}

/**
 * FgdEngine
 * 
 * Modular Object-Oriented Engine for Developer Test Mode:
 * - Processes garment images fresh from disk without reference to prior DB text
 * - Extracts Label, Garment Description, and Hashtags (FGD)
 * - Compares with original baseline FGD
 * - Outputs differences in bullet points
 * - Formulates Labelling Rules/Pattern amendments
 * - Rates quality out of 10.0
 * - Executes automated Loop 2 when score < 9.0 (max 2 loops)
 * - Generates comprehensive QA test report
 */
export class FgdEngine {
  private baseDir: string;
  private ocrCacheFile: string;
  private ocrMemoryCache: Map<string, any> = new Map();

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.ocrCacheFile = path.join(baseDir, 'data', 'ocr_cache.json');
    this.loadOcrCacheFromDisk();
  }

  private loadOcrCacheFromDisk(): void {
    try {
      const dataDir = path.dirname(this.ocrCacheFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (fs.existsSync(this.ocrCacheFile)) {
        const raw = fs.readFileSync(this.ocrCacheFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            this.ocrMemoryCache.set(k, v);
          }
        }
      }
    } catch (err) {
      console.warn('[FgdEngine] Could not load OCR cache from disk:', err);
    }
  }

  private persistOcrCacheToDisk(): void {
    try {
      const obj: Record<string, any> = {};
      for (const [k, v] of this.ocrMemoryCache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.ocrCacheFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[FgdEngine] Could not persist OCR cache to disk:', err);
    }
  }

  public getCachedOcr(cacheKey: string): any {
    return this.ocrMemoryCache.get(cacheKey) || null;
  }

  public setCachedOcr(cacheKey: string, data: any): void {
    this.ocrMemoryCache.set(cacheKey, {
      ...data,
      cached_at: new Date().toISOString()
    });
    this.persistOcrCacheToDisk();
  }

  public clearGarmentOcrCache(garmentId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.ocrMemoryCache.keys()) {
      if (key.includes(garmentId)) {
        keysToDelete.push(key);
      }
    }
    for (const k of keysToDelete) {
      this.ocrMemoryCache.delete(k);
    }
    this.persistOcrCacheToDisk();
  }

  private getGeminiClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Resilient Gemini caller with exponential backoff on 429 quota exhaustion
   * and intelligent fallback across flash & pro models.
   */
  private async generateContentWithFallback(params: {
    contents: any;
    config?: any;
    primaryModel?: string;
    onThrottle?: (msg: string) => void;
  }): Promise<string> {
    const ai = this.getGeminiClient();
    // Enforce modern Flash models with lite fallback for rate-limit resilience
    const modelsToTry = [
      params.primaryModel || 'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];

    let lastError: any = null;
    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const reqConfig = { ...(params.config || {}) };
          // Remove thinkingConfig for gemini-2.5-flash to prevent invalid argument errors
          if (reqConfig.thinkingConfig) {
            delete reqConfig.thinkingConfig;
          }

          const res = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: reqConfig
          });
          if (res && res.text) return res.text;
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || String(err);
          const isQuota = err?.status === 429 || msg.includes('429') || msg.includes('Quota') || msg.includes('quota') || msg.includes('exhausted');
          const isDemand = err?.status === 503 || msg.includes('503') || msg.includes('demand') || msg.includes('overloaded');

          console.warn(`[FgdEngine] Model ${model} attempt ${attempt} warning:`, msg);

          if ((isQuota || isDemand) && attempt < 3) {
            const delayMs = attempt === 1 ? 1500 : 3000;
            if (params.onThrottle) {
              params.onThrottle(`Rate limit on ${model}. Exponential backoff ${delayMs}ms (attempt ${attempt}/3)...`);
            }
            await new Promise(r => setTimeout(r, delayMs));
            continue;
          }
          break; // Fall through to next model
        }
      }
    }
    throw lastError || new Error("Failed to generate content after fallbacks");
  }

  /**
   * Retrieves original baseline FGD from database or fallback JSON
   */
  public async getOriginalFgd(garmentId: string): Promise<FgdData> {
    const dbGarments = await db.select().from(garments).where(eq(garments.id, garmentId));
    let g: any = dbGarments.length > 0 ? dbGarments[0] : null;

    // Check summaries table for jennifer description if not in garment row
    let descriptionText = g?.description || '';
    const dbSummaries = await db.select().from(summaries).where(eq(summaries.garment_id, garmentId));
    if (dbSummaries.length > 0 && dbSummaries[0].summary_text) {
      descriptionText = dbSummaries[0].summary_text;
    }

    // Check garments_data.json fallback if fields are sparse
    const jsonPath = path.join(this.baseDir, 'public', 'garments_data.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (Array.isArray(fileContent)) {
          const matched = fileContent.find((item: any) => item.id === garmentId);
          if (matched) {
            if (!descriptionText && matched.jennifer_emulator_raw) {
              descriptionText = matched.jennifer_emulator_raw;
            }
            if (!g) g = matched;
            else {
              // Merge non-empty fields from json
              for (const [k, v] of Object.entries(matched)) {
                if (v && (!g[k] || g[k] === '')) {
                  g[k] = v;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[FgdEngine] garments_data.json read error:", e);
      }
    }

    // Parse hashtags
    let rawTags = g?.hashtags || '';
    let tagsList: string[] = [];
    if (typeof rawTags === 'string' && rawTags.trim()) {
      tagsList = rawTags
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);
    }

    return {
      label: {
        buyer: g?.buyer || '',
        brand_code: g?.brand_code || g?.brand || '',
        season: g?.season || '',
        sales: g?.sales || '',
        merchandiser: g?.merchandiser || '',
        cust_style_no: g?.cust_style_no || '',
        y_style_no: g?.y_style_no || '',
        sample_job_no: g?.sample_job_no || g?.id || '',
        goods_no: g?.goods_no || '',
        sample_stage: g?.sample_stage || '',
        garment_type: g?.garment_type || '',
        washing: g?.washing || '',
        fabric_raw: g?.fabric_raw || '',
        fabric_material: g?.fabric_material || '',
        fabric_yarn_count: g?.fabric_yarn_count || '',
        fabric_construction: g?.fabric_construction || '',
        color: g?.color || '',
        size: g?.size || '',
        gnw_weight: g?.gnw_weight || '',
        remark_memo: g?.remark_memo || '',
        handwritten_notes: g?.handwritten_notes || ''
      },
      garment_description: descriptionText.trim(),
      hashtags: tagsList
    };
  }

  /**
   * Purely synchronous scan of disk-based images for a given garment.
   * Zero database overhead.
   */
  public getGarmentImagesFromDisk(garmentId: string, loadBase64: boolean = false): { filename: string; role: string; base64: string }[] {
    const imagesDir = path.join(this.baseDir, 'public', 'images');
    const imagesAiDir = path.join(this.baseDir, 'public', 'images_ai');

    const matched: { filename: string; role: string; base64: string }[] = [];
    if (!fs.existsSync(imagesDir) && !fs.existsSync(imagesAiDir)) {
      return matched;
    }

    // 1. Prioritize standard Winzen patterns
    const labelFile = `${garmentId}.jpg`;
    const frontFile = `${garmentId} (F).jpg`;
    const backFile = `${garmentId} (B).jpg`;

    const candidates = [
      { name: labelFile, role: 'Label' },
      { name: frontFile, role: 'Front' },
      { name: backFile, role: 'Back' }
    ];

    for (const cand of candidates) {
      const aiPath = path.join(imagesAiDir, cand.name);
      const rawPath = path.join(imagesDir, cand.name);
      const targetPath = fs.existsSync(aiPath) ? aiPath : (fs.existsSync(rawPath) ? rawPath : null);

      if (targetPath) {
        let base64 = '';
        if (loadBase64) {
          try {
            const buf = fs.readFileSync(targetPath);
            base64 = buf.toString('base64');
          } catch {}
        }
        matched.push({
          filename: cand.name,
          role: cand.role,
          base64
        });
      }
    }

    // 2. If none found with exact names, check directory files
    if (matched.length === 0 && fs.existsSync(imagesDir)) {
      try {
        const files = fs.readdirSync(imagesDir);
        for (const f of files) {
          if (f.startsWith(garmentId) && f.endsWith('.jpg')) {
            let role = 'Other';
            if (f.includes('(F)')) role = 'Front';
            else if (f.includes('(B)')) role = 'Back';
            else role = 'Label';

            let base64 = '';
            if (loadBase64) {
              const aiPath = path.join(imagesAiDir, f);
              const targetPath = fs.existsSync(aiPath) ? aiPath : path.join(imagesDir, f);
              try {
                const buf = fs.readFileSync(targetPath);
                base64 = buf.toString('base64');
              } catch {}
            }
            matched.push({
              filename: f,
              role,
              base64
            });
          }
        }
      } catch {}
    }

    const roleWeights: Record<string, number> = { 'Label': 1, 'Front': 2, 'Back': 3 };
    matched.sort((a, b) => (roleWeights[a.role] || 99) - (roleWeights[b.role] || 99));
    return matched;
  }

  /**
   * Discovers and loads image files for garment from disk or PostgreSQL fallback
   * @param garmentId The garment style ID (e.g. 11S-1906, 13S-1060)
   * @param loadBase64 If true, reads image data into base64. If false, returns metadata instantly.
   */
  public async getGarmentImages(garmentId: string, loadBase64: boolean = false): Promise<{ filename: string; role: string; base64: string }[]> {
    // 1. Check disk files first
    const diskMatched = this.getGarmentImagesFromDisk(garmentId, loadBase64);
    if (diskMatched.length > 0) {
      return diskMatched;
    }

    // 2. Resilient Database Fallback: Retrieve from PostgreSQL images table
    const matched: { filename: string; role: string; base64: string }[] = [];
    try {
      if (!loadBase64) {
        // Fast path: Only query lightweight metadata columns! NEVER query raw_base64 or ai_base64!
        const dbImgs = await db.select({
          id: images.id,
          role: images.role,
          filename: images.filename
        }).from(images).where(eq(images.garment_id, garmentId));

        for (const img of dbImgs) {
          matched.push({
            filename: img.filename || `${garmentId}_${img.role || 'Image'}.jpg`,
            role: img.role || 'Label',
            base64: ''
          });
        }
      } else {
        // Slow path for single garment AI test run: load ai_base64 or thumb_base64 or raw_base64
        const dbImgs = await db.select({
          id: images.id,
          role: images.role,
          filename: images.filename,
          ai_base64: images.ai_base64,
          thumb_base64: images.thumb_base64,
          raw_base64: images.raw_base64
        }).from(images).where(eq(images.garment_id, garmentId));

        for (const img of dbImgs) {
          let base64 = img.ai_base64 || img.thumb_base64 || img.raw_base64 || '';
          if (base64.includes('base64,')) {
            base64 = base64.split('base64,')[1];
          }
          matched.push({
            filename: img.filename || `${garmentId}_${img.role || 'Image'}.jpg`,
            role: img.role || 'Label',
            base64
          });
        }
      }
    } catch (dbErr) {
      console.warn(`[FgdEngine] Failed to retrieve images from PostgreSQL for ${garmentId}:`, dbErr);
    }

    // Ensure standard role sort order (Label first, then Front, then Back)
    const roleWeights: Record<string, number> = { 'Label': 1, 'Front': 2, 'Back': 3 };
    matched.sort((a, b) => (roleWeights[a.role] || 99) - (roleWeights[b.role] || 99));

    return matched;
  }

  /**
   * Generates fresh FGD chunked into bite-sized analytical operations:
   * Bite 1: Label OCR from Spec Sheet / Tag Image
   * Bite 2: Visual Aesthetic Description from Front & Back Images
   * Bite 3: Search Hashtags from Label & Styling features
   */
  public async generateFreshFgd(
    garmentId: string,
    images: { filename: string; role: string; base64: string }[],
    additionalRuleInstructions: string[] = [],
    onStep?: (step: string, detail: string) => void
  ): Promise<FgdData> {
    // Fetch active rules and abbreviations from DB
    const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
    const activeAbbr = await db.select().from(abbreviation_library);

    const rulesText = activeRules
      .map(r => `[${r.rule_code}] (${r.rule_type.toUpperCase()}) ${r.rule_title}: ${r.rule_instruction} (Trigger: ${r.condition_trigger})`)
      .join('\n');

    const abbrText = activeAbbr
      .map(a => `${a.term} -> ${a.expansion_en} (${a.category})`)
      .join('\n');

    const loopAmendmentsText = additionalRuleInstructions.length > 0
      ? `\nNEWLY CALIBRATED AMENDED RULES TO STRICTLY ENFORCE:\n${additionalRuleInstructions.join('\n')}\n`
      : '';

    // Cache key for the entire visual pass
    const cacheKey = `${garmentId}_omni_vision_${images.map(img => img.filename).join('_')}`;
    const cachedOmni = this.getCachedOcr(cacheKey);

    let extractedLabel: FgdLabelData = {};
    let garmentDescription = '';
    let hashtags: string[] = [];

    if (cachedOmni && cachedOmni.extracted_label && cachedOmni.garment_description && additionalRuleInstructions.length === 0) {
      // ⚡ FAST PATH: Reuse cached high-precision Omni transcription (0 image tokens)
      extractedLabel = { ...cachedOmni.extracted_label };
      garmentDescription = cachedOmni.garment_description;
      hashtags = cachedOmni.hashtags || [];
      if (onStep) onStep('Single-Pass Vision', `Loaded cached Omni vision payload for ${garmentId} (0 vision tokens used)`);
    } else if (cachedOmni && cachedOmni.extracted_label && additionalRuleInstructions.length > 0) {
      // ⚡ CALIBRATION PATH: Apply new rule amendments to cached text (fast text-only pass)
      if (onStep) onStep('Text-Only Calibration', `Applying amended rules to cached visual transcription (fast text-only pass)...`);
      const textOnlyPrompt = `You are Winzen's Senior Technical Merchandiser and Textile Spec OCR Specialist.
Review this previously extracted visual payload for garment "${garmentId}":
LABEL DATA:
${JSON.stringify(cachedOmni.extracted_label, null, 2)}
DESCRIPTION:
${cachedOmni.garment_description}
HASHTAGS:
${JSON.stringify(cachedOmni.hashtags)}

GLOSSARY (DO NOT SPECULATE OR GUESS UNLISTED ACRONYMS):
${abbrText}

ACTIVE RULES:
${rulesText}
${loopAmendmentsText}

LITERAL OCR & ZERO-OMISSION INVARIANTS:
1. ZERO-OMISSION INVARIANT: Capture ALL printed, stamped, and handwritten text on the label without loss. No annotation, mark, stamp, or signature may be ignored or discarded.
2. EXTENSIBLE HANDWRITTEN & MARKS BUFFER: Any handwritten notes, inspector initials, approval stamps, penciled corrections, or stray marginalia MUST be captured into "handwritten_notes".
3. STUBBORN LITERALITY: Transcribe exact visible printed or handwritten text. Do NOT guess or rewrite unverified acronyms. If handwritten text reads "BMA" under "HB", record literal "BMA". NEVER expand to "Boss Black Men".
4. FIELD ISOLATION:
   - winzen_style_no / y_style_no: Factory internal style code (e.g. "20S-1004-2"). NEVER replace with customer style codes.
   - cust_style_no: Customer style name & article number (e.g. "HAVOOG 50443691").
   - sample_job_no: Factory production job order (e.g. "20S-1004-2").
   - goods_no: Goods/Material order number on label (e.g. "MA12233/SL-457").
   - merchandiser: Merchandiser name (e.g. "Amy").
   - sales: Sales representative(s) (e.g. "顏卓湖/許秋玲").
   - brand_code: Brand division code or handwritten sub-brand abbreviation (e.g. "BMA").
   - sample_stage: Hong Kong approval stage (e.g. "大辦", "初辦", "產前辦", "洗水辦"). NEVER place into garment_type.
   - garment_type: Physical apparel category for library search (e.g. "Men's Knitted Pant", "T-Shirt", "Jacket").
   - remark_memo: Printed memo, notes, or instructions in the memo block.
   - handwritten_notes: Stray marks, handwritten notes, approval stamps, inspector initials, or corrections.

Re-evaluate the structured fields and description strictly enforcing the newly calibrated amended rules and the zero-omission invariant.
Return ONLY valid JSON matching this schema:
{
  "label": {
    "buyer": "string", "brand_code": "string", "season": "string", "sales": "string", "merchandiser": "string",
    "cust_style_no": "string", "y_style_no": "string", "winzen_style_no": "string",
    "sample_job_no": "string", "goods_no": "string", "sample_stage": "string", "garment_type": "string", "washing": "string",
    "fabric_raw": "string", "fabric_material": "string", "fabric_yarn_count": "string", "fabric_construction": "string",
    "color": "string", "size": "string", "gnw_weight": "string", "remark_memo": "string", "handwritten_notes": "string"
  },
  "garment_description": "string",
  "hashtags": ["#tag1"]
}`;

      try {
        const textResponse = await this.generateContentWithFallback({
          contents: { parts: [{ text: textOnlyPrompt }] },
          config: { responseMimeType: 'application/json', temperature: 0.0 },
          onThrottle: (msg) => { if (onStep) onStep('Calibration Pass', msg); }
        });
        const parsed = JSON.parse(textResponse || '{}');
        extractedLabel = parsed.label || cachedOmni.extracted_label;
        garmentDescription = parsed.garment_description || cachedOmni.garment_description;
        hashtags = parsed.hashtags || cachedOmni.hashtags;
      } catch (e: any) {
        console.warn('[FgdEngine] Text-only rule alignment fallback warning:', e);
        extractedLabel = { ...cachedOmni.extracted_label };
        garmentDescription = cachedOmni.garment_description;
        hashtags = cachedOmni.hashtags || [];
      }
    } else {
      // 📷 SINGLE-PASS VISION: Extract OCR, Aesthetics, and Hashtags in ONE call
      if (onStep) onStep('Single-Pass Vision', `Analyzing ${images.length} photographic views simultaneously...`);

      const visualParts: any[] = images.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.base64
        }
      }));

      const omniPrompt = `You are Winzen's Senior Technical Merchandiser and Textile Spec OCR Specialist.
Carefully examine ALL attached photographic views (Label/Spec tag, Front, Back) for garment style "${garmentId}".

Your task is to perform a complete Single-Pass Vision extraction covering three areas:
1. LABEL OCR: Extract structured spec sheet data.
2. DESCRIPTION: Write a 2-4 sentence authoritative technical summary of silhouette, buyer, fabric, wash, and visual styling.
3. TAXONOMY: Generate 10-16 high-value search tags starting with '#' based on the visual details and label data.

STRICT LITERAL EXTRACTION & ZERO-OMISSION RULES (DO NOT HALLUCINATE OR SPECULATE):
- ZERO-OMISSION INVARIANT: Capture ALL printed, stamped, and handwritten text on the label without loss. No annotation, mark, stamp, or signature may be ignored or discarded.
- EXTENSIBLE HANDWRITTEN & MARKS BUFFER: Any handwritten notes, inspector initials, approval stamps, penciled corrections, or stray marginalia MUST be captured into "handwritten_notes".
- STUBBORN LITERALITY: Transcribe exact visible printed or handwritten text. Do NOT guess or rewrite unverified acronyms. If handwritten text says "BMA" under "HB", keep it as literal "BMA". NEVER expand to "Boss Black Men".
- IDENTITY & PERSONNEL FIELD ISOLATION:
  * winzen_style_no / y_style_no: Internal Winzen factory style code (e.g. "20S-1004-2"). NEVER overwrite or replace with customer text.
  * cust_style_no: Customer external style and article number (e.g. "HAVOOG 50443691").
  * sample_job_no: Factory production job order (e.g. "20S-1004-2" or "MA12233/SL-457").
  * goods_no: Secondary Goods/Material order number on label (e.g. "MA12233/SL-457").
  * merchandiser: Merchandiser name printed or handwritten on label (e.g. "Amy").
  * sales: Sales representative(s) listed on label (e.g. "顏卓湖/許秋玲").
  * brand_code: Secondary brand / division code or handwritten sub-brand abbreviation (e.g. "BMA" underneath "HB"). Keep literal.
  * sample_stage: Manufacturing approval milestone stage (e.g. "大辦", "初辦", "產前辦", "洗水辦"). NEVER place into garment_type.
  * garment_type: Physical apparel category for library search (e.g. "Men's Knitted Pant", "T-Shirt", "Jacket", "Polo").
  * remark_memo: Printed memo, notes, or instructions in the memo block.
  * handwritten_notes: Stray marks, handwritten notes, approval stamps, inspector initials, or corrections.

GLOSSARY (USE ONLY FOR EXACT MATCHES, NEVER GUESS UNLISTED ACRONYMS):
${abbrText}

ACTIVE RULES:
${rulesText}
${loopAmendmentsText}

Return ONLY valid JSON matching this exact schema:
{
  "label": {
    "buyer": "string", "brand_code": "string", "season": "string", "sales": "string", "merchandiser": "string",
    "cust_style_no": "string", "y_style_no": "string", "winzen_style_no": "string",
    "sample_job_no": "string", "goods_no": "string", "sample_stage": "string", "garment_type": "string", "washing": "string",
    "fabric_raw": "string", "fabric_material": "string", "fabric_yarn_count": "string", "fabric_construction": "string",
    "color": "string", "size": "string", "gnw_weight": "string", "remark_memo": "string", "handwritten_notes": "string"
  },
  "garment_description": "string",
  "hashtags": ["#tag1", "#tag2"]
}`;

      try {
        const response = await this.generateContentWithFallback({
          contents: {
            parts: [
              ...visualParts,
              { text: omniPrompt }
            ]
          },
          config: { responseMimeType: 'application/json', temperature: 0.0 },
          onThrottle: (msg) => { if (onStep) onStep('Single-Pass Vision', msg); }
        });
        
        const parsed = JSON.parse(response || '{}');
        extractedLabel = parsed.label || {};
        garmentDescription = parsed.garment_description || '';
        hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

        // Persist to durable disk OCR cache
        this.setCachedOcr(cacheKey, {
          garment_id: garmentId,
          extracted_label: extractedLabel,
          garment_description: garmentDescription,
          hashtags: hashtags
        });
        
        if (onStep) onStep('Single-Pass Vision', `Successfully extracted and cached unified payload (Label, ${garmentDescription.split(' ').length} words desc, ${hashtags.length} tags)`);
      } catch (e: any) {
        console.warn('[FgdEngine] Single-Pass Vision fallback warning:', e);
        if (onStep) onStep('Single-Pass Vision', `Warning: Vision parser used fallback (${e?.message || e})`);
      }
    }

    return {
      label: extractedLabel,
      garment_description: garmentDescription,
      hashtags
    };
  }

  /**
   * Compares fresh FGD with baseline original FGD
   */
  public compareFgd(original: FgdData, fresh: FgdData): { differences: FgdDiffItem[]; bulletpoints: string[] } {
    const diffs: FgdDiffItem[] = [];
    const bullets: string[] = [];

    // 1. Label Comparison
    const labelKeys: (keyof FgdLabelData)[] = [
      'buyer', 'brand_code', 'cust_style_no', 'y_style_no', 'winzen_style_no', 'sample_job_no', 'goods_no',
      'sales', 'merchandiser', 'sample_stage', 'garment_type', 
      'fabric_material', 'fabric_yarn_count', 'fabric_construction', 
      'fabric_raw', 'washing', 'color', 'size', 'season', 'gnw_weight', 'remark_memo', 'handwritten_notes'
    ];

    for (const key of labelKeys) {
      const origVal = (original.label[key] || '').trim();
      const freshVal = (fresh.label[key] || '').trim();

      if (origVal !== freshVal) {
        let analysis = `Discrepancy in ${key}: `;
        if (!origVal && freshVal) {
          if (key === 'handwritten_notes') {
            analysis = `Zero-Omission Capture: Extracted handwritten notes/stamps "${freshVal}" previously omitted in baseline.`;
          } else if (key === 'brand_code') {
            analysis = `Extracted brand division code "${freshVal}" (e.g. sub-brand abbreviation).`;
          } else if (key === 'merchandiser' || key === 'sales') {
            analysis = `Identified personnel assignment "${freshVal}" previously missing in baseline.`;
          } else if (key === 'goods_no') {
            analysis = `Captured order/goods number "${freshVal}".`;
          } else {
            analysis = `Freshly discovered tag field "${freshVal}" previously missing in baseline.`;
          }
        } else if (origVal && !freshVal) {
          analysis = `Baseline contained "${origVal}", but fresh extraction missed it.`;
        } else {
          analysis = `Value variation: "${origVal}" (Baseline) vs "${freshVal}" (Fresh OCR).`;
        }

        diffs.push({
          category: 'Label',
          field: key,
          original: origVal,
          fresh: freshVal,
          analysis
        });

        bullets.push(`• **Label [${key}]**: Baseline "${origVal || '(empty)'}" ↔ Fresh "${freshVal || '(empty)'}" (${analysis})`);
      }
    }

    // 2. Garment Description Comparison
    const origDesc = original.garment_description.trim();
    const freshDesc = fresh.garment_description.trim();

    if (origDesc !== freshDesc) {
      // Analyze specific technical nuances
      const missingKeywords: string[] = [];
      const newKeywords: string[] = [];

      // Check key technical attributes
      const checkTerms = [
        'BMW Masters', 'S.Cafe', 'PU', 'bonded fleece', 'tie-dye', 
        'garment dye', 'piping', '32/1', 'V-neck', 'pullover', 'quarter-zip'
      ];

      for (const term of checkTerms) {
        const inOrig = origDesc.toLowerCase().includes(term.toLowerCase());
        const inFresh = freshDesc.toLowerCase().includes(term.toLowerCase());
        if (inOrig && !inFresh) missingKeywords.push(term);
        if (!inOrig && inFresh) newKeywords.push(term);
      }

      let descAnalysis = "Description text re-generated from fresh visual examination.";
      if (missingKeywords.length > 0) {
        descAnalysis += ` Missed attributes: ${missingKeywords.join(', ')}.`;
      }
      if (newKeywords.length > 0) {
        descAnalysis += ` Newly identified attributes: ${newKeywords.join(', ')}.`;
      }

      diffs.push({
        category: 'Garment Description',
        original: origDesc,
        fresh: freshDesc,
        analysis: descAnalysis
      });

      bullets.push(`• **Garment Description**: ${descAnalysis}`);
    }

    // 3. Hashtags Comparison
    const origTags = new Set(original.hashtags.map(t => t.toLowerCase()));
    const freshTags = new Set(fresh.hashtags.map(t => t.toLowerCase()));

    const missingTags = original.hashtags.filter(t => !freshTags.has(t.toLowerCase()));
    const addedTags = fresh.hashtags.filter(t => !origTags.has(t.toLowerCase()));

    if (missingTags.length > 0 || addedTags.length > 0) {
      const tagAnalysis = `Tag coverage diff: -${missingTags.length} original tags, +${addedTags.length} newly generated tags.`;
      diffs.push({
        category: 'Hashtags',
        original: original.hashtags.join(' '),
        fresh: fresh.hashtags.join(' '),
        analysis: tagAnalysis
      });

      if (missingTags.length > 0) {
        bullets.push(`• **Hashtags Missing vs Original**: ${missingTags.join(', ')}`);
      }
      if (addedTags.length > 0) {
        bullets.push(`• **Hashtags Newly Suggested**: ${addedTags.join(', ')}`);
      }
    }

    return { differences: diffs, bulletpoints: bullets };
  }

  /**
   * Rule Index Sequencing: Queries `SELECT rule_code FROM labeling_rules`
   * to compute the next sequential number (e.g., RULE-HB-04, RULE-CALIB-02),
   * eliminating hardcoded "01" duplicates.
   */
  public async getNextSequentialRuleCode(basePrefix: string = 'RULE-CALIB', reservedCodes: Set<string> = new Set()): Promise<string> {
    const rows = await db.select({ rule_code: labeling_rules.rule_code }).from(labeling_rules);
    const allCodes = new Set([...rows.map(r => (r.rule_code || '').trim()), ...Array.from(reservedCodes).map(c => c.trim())]);

    let prefix = basePrefix.replace(/[-_]?0*\d+$/, '').replace(/[-_]$/, '').trim();
    if (!prefix) prefix = 'RULE-CALIB';

    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedPrefix}[-_](\\d+)$`, 'i');

    let maxNum = 0;
    let minDigits = 2;

    for (const code of allCodes) {
      const match = code.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          if (num > maxNum) maxNum = num;
          if (match[1].length > minDigits) minDigits = match[1].length;
        }
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `${prefix}-${String(nextNum).padStart(minDigits, '0')}`;
    while (allCodes.has(candidate)) {
      nextNum++;
      candidate = `${prefix}-${String(nextNum).padStart(minDigits, '0')}`;
    }

    reservedCodes.add(candidate);
    return candidate;
  }

  /**
   * Synthesizes concrete Labelling Rules & Patterns from observed discrepancies
   */
  public async generateRuleAmendments(
    garmentId: string,
    diffs: FgdDiffItem[],
    fresh: FgdData,
    original: FgdData
  ): Promise<RuleAmendment[]> {
    const ai = this.getGeminiClient();

    const diffsSummary = diffs.map(d => `[${d.category}${d.field ? `:${d.field}` : ''}] Original: "${d.original}" | Fresh: "${d.fresh}" | Analysis: ${d.analysis}`).join('\n');

    const prompt = `You are a Senior Knowledge Engineer at Winzen Apparel.
Analyze the following differences between the baseline Full Garment Description (FGD) and a fresh image-based extraction for Garment "${garmentId}":

DIFFERENCES OBSERVED:
${diffsSummary}

CURRENT FRESH LABEL DATA:
${JSON.stringify(fresh.label, null, 2)}

CURRENT FRESH DESCRIPTION:
"${fresh.garment_description}"

Generate 1-3 highly specific, reusable Labelling Rules / Pattern Amendments that calibrate the system to permanently resolve these discrepancies.
Each rule must strictly follow the Winzen rule schema:
- rule_code: unique code (e.g. "RULE-CALIB-01" or "NEG-CALIB-01")
- rule_type: "positive" (mandatory extraction pattern) or "negative" (strict prohibition)
- target_field: e.g. "garment_type", "fabric_material", "buyer", "cust_style_no", or "garment_description"
- rule_title: concise title
- condition_trigger: exact textual or visual trigger
- rule_instruction: clear rule directive for future OCR / description models
- example_positive: desired output
- example_negative: flawed output
- source_feedback: "FGD Test Mode Calibration - ${garmentId}"

Return ONLY a valid JSON array of rules:
[
  {
    "rule_code": "string",
    "rule_type": "positive" | "negative",
    "target_field": "string",
    "rule_title": "string",
    "condition_trigger": "string",
    "rule_instruction": "string",
    "example_positive": "string",
    "example_negative": "string",
    "source_feedback": "string"
  }
]`;

    try {
      const rawText = await this.generateContentWithFallback({
        contents: prompt,
        primaryModel: 'gemini-2.5-flash',
        config: { 
          responseMimeType: 'application/json'
        }
      });
      const parsed = JSON.parse(rawText || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        const reserved = new Set<string>();
        const amendments: RuleAmendment[] = [];
        for (let idx = 0; idx < parsed.length; idx++) {
          const r = parsed[idx];
          const prefix = r.rule_type === 'negative' ? 'NEG-CALIB' : 'RULE-CALIB';
          const suggested = r.rule_code && !r.rule_code.includes('01') ? r.rule_code : prefix;
          const sequentialCode = await this.getNextSequentialRuleCode(suggested, reserved);
          amendments.push({
            rule_code: sequentialCode,
            rule_type: r.rule_type === 'negative' ? 'negative' : 'positive',
            target_field: r.target_field || 'garment_description',
            rule_title: r.rule_title || `Rule Calibration for ${garmentId}`,
            condition_trigger: r.condition_trigger || '',
            rule_instruction: r.rule_instruction || '',
            example_positive: r.example_positive || '',
            example_negative: r.example_negative || '',
            source_feedback: `FGD Test Mode Calibration - ${garmentId}`
          });
        }
        return amendments;
      }
    } catch (e) {
      console.warn("[FgdEngine] Rule amendment generation fallback:", e);
    }

    return [];
  }

  /**
   * Digests natural language merchandiser commentary and translates it into formal, structured rules
   */
  public async digestCommentaryIntoRules(params: {
    userComment: string;
    garmentId?: string;
    existingRule?: RuleAmendment;
    diffsSummary?: string;
  }): Promise<RuleAmendment[]> {
    const { userComment, garmentId = 'GENERAL', existingRule, diffsSummary } = params;

    const prompt = `You are a Senior Knowledge & Domain Engineering AI for Winzen Apparel catalog curation.
A human merchandiser or domain expert has provided natural language commentary/feedback regarding garment labeling, brand architecture, fabric standards, or catalog taxonomy:

MERCHANDISER COMMENTARY:
"${userComment}"

${existingRule ? `EXISTING DRAFT RULE CONTEXT:
Title: ${existingRule.rule_title}
Target Field: ${existingRule.target_field}
Trigger: ${existingRule.condition_trigger}
Directive: ${existingRule.rule_instruction}` : ''}

${diffsSummary ? `OBSERVED DISCREPANCY CONTEXT:
${diffsSummary}` : ''}

YOUR TASK:
Digest, synthesize, and translate this natural language merchandiser commentary into 1 to 2 precise, structured labeling rules following the Winzen Apparel schema.
Do NOT require the merchandiser to write technical triggers or formal code; extract the core intent, target field, triggers, and formal directives automatically.

Target fields can include:
- 'buyer' (brand architecture, sub-brands, divisional lines, corporate restructuring)
- 'garment_type' (silhouette, necklines, sleeves, styling)
- 'fabric_material' (fiber percentages, compositions)
- 'fabric_raw' (textual fabric notes, knit structures, yarns)
- 'gnw_weight' (fabric weight, GSM)
- 'washing' (wash instructions, treatments, dyeing)
- 'garment_description' (overall visual descriptions)
- 'hashtags' (search indexing tags)

CRITICAL INSTRUCTIONS FOR HUGO BOSS IF MENTIONED:
If Hugo Boss is mentioned: Respect that 'HUGO' and 'BOSS' are the two permanent corporate brand pillars with separate retail stores, distinct aesthetics, and target demographics (HUGO = progressive Gen Z streetwear / red accents; BOSS = contemporary luxury / tailoring / camel-black-white palette, with sub-lines Black, Orange, Green). This is a permanent brand architecture, NOT a temporal line.

Return ONLY a valid JSON array of rules:
[
  {
    "rule_code": "RULE-MERCH-01",
    "rule_type": "positive",
    "target_field": "buyer",
    "rule_title": "Concise professional title",
    "condition_trigger": "Exact conditions when this rule triggers",
    "rule_instruction": "Synthesized directive clearly instructing OCR and catalog tagging engines how to classify",
    "example_positive": "Specific desired catalog output",
    "example_negative": "Specific incorrect or discouraged output",
    "source_feedback": "Merchandiser Commentary",
    "user_comment": "original user comment"
  }
]`;

    try {
      const rawText = await this.generateContentWithFallback({
        contents: prompt,
        primaryModel: 'gemini-2.5-flash',
        config: { 
          responseMimeType: 'application/json'
        }
      });
      const parsed = JSON.parse(rawText || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        const isHugoBoss = /hugo|boss|hb/i.test(userComment);
        const defaultPrefix = isHugoBoss ? 'RULE-HB' : 'RULE-MERCH';
        const reserved = new Set<string>();
        const digested: RuleAmendment[] = [];

        for (let idx = 0; idx < parsed.length; idx++) {
          const r = parsed[idx];
          const suggested = r.rule_code && !r.rule_code.includes('01') ? r.rule_code : defaultPrefix;
          const sequentialCode = await this.getNextSequentialRuleCode(suggested, reserved);
          digested.push({
            rule_code: sequentialCode,
            rule_type: r.rule_type === 'negative' ? 'negative' : 'positive',
            target_field: r.target_field || (existingRule?.target_field || 'garment_description'),
            rule_title: r.rule_title || (existingRule?.rule_title || `Merchandiser Rule (${garmentId})`),
            condition_trigger: r.condition_trigger || (existingRule?.condition_trigger || `Triggered when cataloging ${r.target_field || 'garments'}`),
            rule_instruction: r.rule_instruction || userComment,
            example_positive: r.example_positive || '',
            example_negative: r.example_negative || '',
            source_feedback: `Merchandiser Guidance for ${garmentId}: ${userComment.slice(0, 100)}`,
            user_comment: userComment
          });
        }
        return digested;
      }
    } catch (err) {
      console.error("[FgdEngine] Failed to digest commentary with Gemini:", err);
    }

    // Heuristic fallback
    const isBuyer = /boss|hugo|brand|buyer/i.test(userComment);
    const isFabric = /fabric|material|cotton|polyester|linen|weight|gnw|gsm/i.test(userComment);
    const isType = /tee|t-shirt|collar|neck|sleeve|pant|hoodie|jacket/i.test(userComment);
    const targetField = isBuyer ? 'buyer' : isFabric ? 'fabric_material' : isType ? 'garment_type' : (existingRule?.target_field || 'garment_description');
    const fallbackPrefix = isBuyer ? 'RULE-HB' : 'RULE-MERCH';
    const sequentialFallbackCode = await this.getNextSequentialRuleCode(existingRule?.rule_code || fallbackPrefix);

    return [{
      rule_code: sequentialFallbackCode,
      rule_type: 'positive',
      target_field: targetField,
      rule_title: isBuyer ? 'Hugo Boss Permanent Brand Architecture (HUGO vs BOSS)' : `Merchandiser Rule: ${userComment.slice(0, 45)}...`,
      condition_trigger: isBuyer ? "Tag identifies 'Hugo Boss', 'HB', 'HUGO', or 'BOSS'" : `Evaluation of ${targetField}`,
      rule_instruction: isBuyer 
        ? "Classify into the permanent brand architecture: 'HUGO' (Gen Z / progressive streetwear / red logo / standalone retail stores) or 'BOSS' (contemporary luxury / tailoring / camel-black-white branding). This is a permanent brand architecture, not a temporal line."
        : userComment,
      example_positive: isBuyer ? 'BOSS (or HUGO)' : '',
      example_negative: isBuyer ? 'HB (Hugo Boss) (omitting permanent brand pillar)' : '',
      source_feedback: `Merchandiser Guidance: ${userComment}`,
      user_comment: userComment
    }];
  }

  /**
   * Rates the fresh FGD out of 10.0
   */
  public rateFgd(
    original: FgdData,
    fresh: FgdData,
    diffs: FgdDiffItem[]
  ): { score: number; breakdown: { label_accuracy: number; description_fidelity: number; hashtag_coverage: number }; summary: string } {
    let labelScore = 4.0;
    let descScore = 4.0;
    let tagScore = 2.0;

    // Deduct for label discrepancies
    const criticalFields = ['buyer', 'brand_code', 'cust_style_no', 'y_style_no', 'goods_no', 'merchandiser', 'garment_type', 'fabric_material', 'handwritten_notes'];
    for (const d of diffs) {
      if (d.category === 'Label') {
        if (d.field && criticalFields.includes(d.field)) {
          // If fresh OCR discovered previously missing fields, treat as discovery rather than penalty
          if (!d.original && d.fresh) {
            // New discovery - do not penalize
          } else if (d.field === 'garment_type' && d.original.includes('辦') && !d.fresh.includes('辦')) {
            // Actually an improvement! No deduction
          } else {
            labelScore = Math.max(1.0, labelScore - 0.5);
          }
        } else {
          labelScore = Math.max(1.5, labelScore - 0.25);
        }
      } else if (d.category === 'Garment Description') {
        if (d.analysis.includes('Missed attributes')) {
          descScore = Math.max(1.5, descScore - 0.6);
        } else {
          descScore = Math.max(2.5, descScore - 0.3);
        }
      } else if (d.category === 'Hashtags') {
        tagScore = Math.max(1.0, tagScore - 0.4);
      }
    }

    labelScore = Math.round(labelScore * 10) / 10;
    descScore = Math.round(descScore * 10) / 10;
    tagScore = Math.round(tagScore * 10) / 10;
    const totalScore = Math.min(10.0, Math.round((labelScore + descScore + tagScore) * 10) / 10);

    const summary = `Overall Score: ${totalScore}/10. Label Accuracy: ${labelScore}/4.0, Description Fidelity: ${descScore}/4.0, Hashtag Coverage: ${tagScore}/2.0.`;

    return {
      score: totalScore,
      breakdown: {
        label_accuracy: labelScore,
        description_fidelity: descScore,
        hashtag_coverage: tagScore
      },
      summary
    };
  }

  /**
   * Generates structured review questions routed directly to Jennifer and Jason
   * for any unresolved discrepancies during 1-loop review evaluation.
   */
  public async generateReviewQuestions(
    garmentId: string,
    diffs: FgdDiffItem[],
    fresh: FgdData,
    original: FgdData
  ): Promise<{ questions: DiscrepancyReviewQuestion[]; formattedText: string }> {
    if (diffs.length === 0) {
      return {
        questions: [],
        formattedText: "All fields match approved catalog rules. Zero unresolved discrepancies."
      };
    }

    const diffsSummary = diffs.map((d, i) => 
      `${i + 1}. [${d.category}${d.field ? `:${d.field}` : ''}] Original Baseline: "${d.original || 'None'}" | Fresh OCR/Catalog Rule: "${d.fresh || 'None'}" | Analysis: ${d.analysis}`
    ).join('\n');

    const prompt = `You are a Technical Merchandising Assistant at Winzen Apparel.
We completed an automated evaluation loop for Garment Under Review "${garmentId}" matching fields against approved catalog rules.
The following unresolved discrepancies were identified between the factory baseline specification and the extracted/rule-applied catalog fields:

${diffsSummary}

CURRENT EXTRACTED SPECIFICATION:
${JSON.stringify(fresh.label, null, 2)}

TASK:
For each unresolved discrepancy, formulate a professional, concise, and structured question routed directly to Senior Merchandisers Jennifer and Jason.
Explain the discrepancy clearly so they can decide on the authoritative taxonomy, naming, or fabric specification without cognitive overhead.
Do NOT generate candidate rules or calibration rules.

Return ONLY a valid JSON object matching this structure:
{
  "questions": [
    {
      "field": "string",
      "category": "string",
      "discrepancy": "Brief explanation of difference",
      "question": "Clear, specific question for Jennifer and Jason to make the decision"
    }
  ],
  "formatted_text": "A clean, formatted text block with numbered questions for Jennifer and Jason"
}`;

    try {
      const raw = await this.generateContentWithFallback({
        contents: prompt,
        primaryModel: 'gemini-3.8-flash',
        config: {
          responseMimeType: 'application/json'
        }
      });
      const parsed = JSON.parse(raw || '{}');
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const text = parsed.formatted_text || `[FGD Review Record - Unresolved Questions for Jennifer & Jason]:\n` +
          parsed.questions.map((q: any, idx: number) => `${idx + 1}. [${q.field || q.category}] ${q.question}`).join('\n\n');
        return {
          questions: parsed.questions,
          formattedText: text
        };
      }
    } catch (err) {
      console.warn("[FgdEngine] Review question generation fallback:", err);
    }

    // Heuristic fallback
    const fallbackQuestions: DiscrepancyReviewQuestion[] = diffs.map(d => ({
      field: d.field || d.category,
      category: d.category,
      discrepancy: `Baseline: "${d.original}" vs Fresh: "${d.fresh}"`,
      question: `Please verify correct merchandising taxonomy for ${d.field || d.category}. Baseline spec lists "${d.original}", while image extraction yields "${d.fresh}".`
    }));

    const formattedText = `[FGD Review Record - Unresolved Questions for Jennifer & Jason]:\n` +
      fallbackQuestions.map((q, idx) => `${idx + 1}. [${q.field}] ${q.question}`).join('\n\n');

    return {
      questions: fallbackQuestions,
      formattedText
    };
  }

  /**
   * Executes the full automated evaluation loop for a garment (Max 2 Loops or fast 1-Loop Review)
   */
  public async runGarmentTest(
    garmentId: string, 
    maxLoops: number = 2,
    onProgress?: (step: string, detail: string) => void,
    options?: GarmentTestOptions
  ): Promise<GarmentTestReport> {
    const images = await this.getGarmentImages(garmentId, true);
    if (images.length === 0) {
      throw new Error(`No image files found for garment ${garmentId} in public/images or database`);
    }

    const isReviewRun = options?.isReviewRun === true;

    if (onProgress) onProgress('Baseline Setup', `Retrieved baseline FGD ground truth for ${garmentId}`);
    const originalFgd = await this.getOriginalFgd(garmentId);
    const loops: LoopResult[] = [];
    const cumulativeAmendments: RuleAmendment[] = [];

    // --- LOOP 1 ---
    if (onProgress) onProgress('Loop 1', isReviewRun ? `Executing fast 1-loop evaluation against approved catalog rules...` : `Executing Loop 1 bite-sized analytical inference...`);
    const freshFgdLoop1 = await this.generateFreshFgd(garmentId, images, [], onProgress);
    
    if (onProgress) onProgress('Comparison', `Computing discrepancy analysis vs original baseline...`);
    const comparisonLoop1 = this.compareFgd(originalFgd, freshFgdLoop1);
    
    if (onProgress) onProgress('Scoring', `Calculating accuracy rating & confidence breakdown...`);
    const ratingLoop1 = this.rateFgd(originalFgd, freshFgdLoop1, comparisonLoop1.differences);
    
    if (isReviewRun) {
      // ⚡ FAST 1-LOOP EVALUATION FOR GARMENTS UNDER REVIEW INVARIANTS:
      // 1. Execute exactly 1 evaluation loop matching fields against existing approved catalog rules.
      // 2. Disable autonomous candidate rule generation: Do NOT emit unsolicited "NEG-CALIB-*" rules.
      // 3. Route unresolved discrepancies directly as structured questions into the garment's review record for Jennifer and Jason.
      let reviewQuestions: DiscrepancyReviewQuestion[] = [];
      let formattedQuestions = '';

      if (comparisonLoop1.differences.length > 0) {
        if (onProgress) onProgress('Review Routing', `Routing ${comparisonLoop1.differences.length} unresolved discrepancies as structured questions for Jennifer & Jason...`);
        const qResult = await this.generateReviewQuestions(garmentId, comparisonLoop1.differences, freshFgdLoop1, originalFgd);
        reviewQuestions = qResult.questions;
        formattedQuestions = qResult.formattedText;

        // Persist directly into the garment review record in Postgres
        try {
          await db.update(garments).set({
            reviewer_feedback: formattedQuestions,
            structural_feedback: formattedQuestions
          }).where(eq(garments.id, garmentId));
        } catch (dbErr) {
          console.error(`[FgdEngine] Failed to save review questions to garment ${garmentId}:`, dbErr);
        }
      }

      loops.push({
        loop_number: 1,
        fresh_fgd: freshFgdLoop1,
        differences: comparisonLoop1.differences,
        bulletpoints: comparisonLoop1.bulletpoints,
        amended_rules: [], // strictly empty - no unsolicited candidate rules
        review_questions: reviewQuestions,
        score: ratingLoop1.score,
        score_breakdown: ratingLoop1.breakdown,
        evaluation_summary: ratingLoop1.summary
      });

      const finalVerdict = reviewQuestions.length === 0
        ? "Approved Match - All Rules Compliant"
        : "Awaiting Merchandiser Review (Jennifer & Jason)";

      return {
        garment_id: garmentId,
        tested_at: new Date().toISOString(),
        images_processed: images.map(img => `${img.filename} (${img.role})`),
        original_fgd: originalFgd,
        loops,
        final_score: ratingLoop1.score,
        final_verdict: finalVerdict,
        cumulative_rule_amendments: [], // strictly empty
        review_questions: reviewQuestions,
        is_review_run: true
      };
    }

    // Standard Calibration Path
    if (onProgress) onProgress('Rule Formulation', `Formulating rule calibration recommendations...`);
    const amendmentsLoop1 = await this.generateRuleAmendments(garmentId, comparisonLoop1.differences, freshFgdLoop1, originalFgd);

    cumulativeAmendments.push(...amendmentsLoop1);

    loops.push({
      loop_number: 1,
      fresh_fgd: freshFgdLoop1,
      differences: comparisonLoop1.differences,
      bulletpoints: comparisonLoop1.bulletpoints,
      amended_rules: amendmentsLoop1,
      score: ratingLoop1.score,
      score_breakdown: ratingLoop1.breakdown,
      evaluation_summary: ratingLoop1.summary
    });

    // --- DECISION GATE: LOOP 2 ---
    // If score < 9.0 or differences are significant, and maxLoops >= 2, run Loop 2 with amended rules
    if (ratingLoop1.score < 9.0 && maxLoops >= 2) {
      if (onProgress) onProgress('Loop 2 Calibration', `Score was ${ratingLoop1.score}/10 (< 9.0). Initiating Loop 2 with ${cumulativeAmendments.length} amended rules...`);
      const amendmentInstructions = cumulativeAmendments.map(
        a => `[AMENDED ${a.rule_code}] (${a.rule_type.toUpperCase()}) ${a.rule_title}: ${a.rule_instruction}`
      );

      const freshFgdLoop2 = await this.generateFreshFgd(garmentId, images, amendmentInstructions, onProgress);
      const comparisonLoop2 = this.compareFgd(originalFgd, freshFgdLoop2);
      const ratingLoop2 = this.rateFgd(originalFgd, freshFgdLoop2, comparisonLoop2.differences);
      const amendmentsLoop2 = await this.generateRuleAmendments(garmentId, comparisonLoop2.differences, freshFgdLoop2, originalFgd);

      cumulativeAmendments.push(...amendmentsLoop2);

      loops.push({
        loop_number: 2,
        fresh_fgd: freshFgdLoop2,
        differences: comparisonLoop2.differences,
        bulletpoints: comparisonLoop2.bulletpoints,
        amended_rules: amendmentsLoop2,
        score: ratingLoop2.score,
        score_breakdown: ratingLoop2.breakdown,
        evaluation_summary: ratingLoop2.summary
      });
    }

    const finalLoop = loops[loops.length - 1];
    const finalScore = finalLoop.score;

    let verdict = "Satisfactory (High Quality)";
    if (finalScore >= 9.0) {
      verdict = "Exceptional - Production Quality";
    } else if (finalScore >= 8.0) {
      verdict = "Very Good - Minor Calibrations Identified";
    } else {
      verdict = "Requires Further Rule Calibration";
    }

    return {
      garment_id: garmentId,
      tested_at: new Date().toISOString(),
      images_processed: images.map(img => `${img.filename} (${img.role})`),
      original_fgd: originalFgd,
      loops,
      final_score: finalScore,
      final_verdict: verdict,
      cumulative_rule_amendments: cumulativeAmendments
    };
  }
}
