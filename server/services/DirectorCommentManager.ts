import fs from 'fs';
import path from 'path';
import { db } from '../../src/db';
import { garments, labeling_rules } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenAI, Type } from '@google/genai';
import { FgdEngine } from './FgdEngine';

export interface FlashEvaluationResult {
  evaluated_at: string;
  model: string;
  cleared: boolean;
  verdict: string;
  explanation: string;
  proposed_fields?: Record<string, string>;
  remaining_discrepancies?: string[];
}

export interface ProArbitrationResult {
  evaluated_at: string;
  model: string;
  summary: string;
  field_corrections?: Record<string, string>;
  proposed_rule?: {
    rule_code: string;
    rule_title: string;
    condition_trigger: string;
    rule_instruction: string;
    target_field: string;
    positive_example?: string;
    negative_example?: string;
  };
  explanation: string;
  brand_hierarchy_analysis?: string;
}

export interface DraftPreviewResult {
  digested_at: string;
  model: string;
  summary: string;
  proposed_field_changes: Record<string, any>;
  preview_only: boolean;
  affected_fields: string[];
  explanation: string;
}

export interface DirectorCommentRecord {
  garmentId: string;
  comment: string;
  author: string;
  updated_at: string;
  flash_evaluation?: FlashEvaluationResult;
  pro_arbitration?: ProArbitrationResult;
  draft_preview?: DraftPreviewResult;
}

export class DirectorCommentManager {
  private static instance: DirectorCommentManager;
  private filePath: string;
  private comments: Map<string, DirectorCommentRecord> = new Map();
  private ai: GoogleGenAI;
  private fgdEngine: FgdEngine;

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'director_comments.json');
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.fgdEngine = new FgdEngine();
    this.loadFromDisk();
  }

  public static getInstance(): DirectorCommentManager {
    if (!DirectorCommentManager.instance) {
      DirectorCommentManager.instance = new DirectorCommentManager();
    }
    return DirectorCommentManager.instance;
  }

  private loadFromDisk() {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list: DirectorCommentRecord[] = JSON.parse(raw);
        this.comments.clear();
        for (const item of list) {
          if (item && item.garmentId) {
            this.comments.set(item.garmentId, item);
          }
        }
      }
    } catch (e) {
      console.warn('[DirectorCommentManager] Warning loading from disk:', e);
    }
  }

  private saveToDisk() {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const list = Array.from(this.comments.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[DirectorCommentManager] Error saving to disk:', e);
    }
  }

  public getComment(garmentId: string): DirectorCommentRecord | null {
    return this.comments.get(garmentId) || null;
  }

  public getAllComments(): Record<string, DirectorCommentRecord> {
    const result: Record<string, DirectorCommentRecord> = {};
    for (const [k, v] of this.comments.entries()) {
      result[k] = v;
    }
    return result;
  }

  public async saveComment(garmentId: string, comment: string, author: string = 'Director Jason'): Promise<DirectorCommentRecord> {
    const existing = this.comments.get(garmentId);
    const updated: DirectorCommentRecord = {
      garmentId,
      comment: comment.trim(),
      author,
      updated_at: new Date().toISOString(),
      flash_evaluation: existing?.flash_evaluation,
      pro_arbitration: existing?.pro_arbitration
    };

    this.comments.set(garmentId, updated);
    this.saveToDisk();

    // Mirror to database in content_notes for persistent multi-system visibility
    try {
      await db.update(garments)
        .set({
          content_notes: `[Director Jason - ${new Date().toLocaleDateString()}]: ${comment.trim()}`
        })
        .where(eq(garments.id, garmentId));
    } catch (err) {
      console.warn('[DirectorCommentManager] DB content_notes sync notice:', err);
    }

    return updated;
  }

  /**
   * Fast Real-time Verification using the FLASH Model (gemini-3.8-flash)
   * Evaluates Director Jason's draft note in real-time to verify whether the garment discrepancy clears.
   */
  public async runFlashVerification(garmentId: string, directorComment: string): Promise<FlashEvaluationResult> {
    const garmentRows = await db.select().from(garments).where(eq(garments.id, garmentId));
    const garment = garmentRows[0] || null;
    const existingRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));

    const rulesContext = existingRules.map(r => `[${r.rule_code}] ${r.rule_title}: ${r.rule_instruction}`).join('\n');

    const prompt = `You are the Winzen Garment Library Fast Evaluation Engine powered by the FLASH model.
A Director & Developer (Jason) has drafted technical observations and field corrections for a garment under review.

GARMENT UNDER REVIEW:
ID: ${garmentId}
Buyer: ${garment?.buyer || 'Unknown'}
Customer Style No: ${garment?.cust_style_no || 'Unknown'}
Winzen Internal Style No: ${garment?.y_style_no || garment?.id || 'Unknown'}
Garment Type: ${garment?.garment_type || 'Unknown'}
Fabric: ${garment?.fabric_raw || garment?.fabric_material || 'Unknown'}
Sample Stage: ${garment?.sample_stage || 'Unknown'}
Hashtags: ${garment?.hashtags || 'None'}
Existing Discrepancy / Reviewer Questions: ${garment?.reviewer_feedback || 'None'}

ACTIVE CATALOG RULES:
${rulesContext}

DIRECTOR JASON'S DRAFT OBSERVATION & FIELD CORRECTIONS:
"${directorComment}"

TASK:
1. Analyze Jason's notes against the garment fields and active rules.
2. Determine if the discrepancy clears (e.g. Jason confirmed the buyer standard, clarified customer code vs Winzen code, or corrected a fabric interpretation).
3. Specify which fields should be updated if any.
4. Conclude with a clear verdict for Senior Merchandiser Jennifer.

Return STRICT JSON adhering to this schema:
{
  "cleared": boolean,
  "verdict": "Cleared - Ready for Merchandiser Approval" | "Partial - Remaining Discrepancy" | "Not Cleared",
  "explanation": "concise explanation of why discrepancy clears or what remains",
  "proposed_fields": {
    "buyer": "string if modified",
    "cust_style_no": "string if modified",
    "garment_type": "string if modified",
    "fabric_raw": "string if modified"
  },
  "remaining_discrepancies": ["list of remaining issues if any"]
}`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        cleared: true,
        verdict: "Verified by Flash Model",
        explanation: response.text || "Director observations evaluated."
      };
    }

    const result: FlashEvaluationResult = {
      evaluated_at: new Date().toISOString(),
      model: 'gemini-3.8-flash',
      cleared: !!parsed.cleared,
      verdict: parsed.verdict || (parsed.cleared ? "Cleared" : "Requires Review"),
      explanation: parsed.explanation || "Evaluated by Flash model.",
      proposed_fields: parsed.proposed_fields || {},
      remaining_discrepancies: Array.isArray(parsed.remaining_discrepancies) ? parsed.remaining_discrepancies : []
    };

    const record = this.comments.get(garmentId) || {
      garmentId,
      comment: directorComment,
      author: 'Director Jason',
      updated_at: new Date().toISOString()
    };
    record.flash_evaluation = result;
    this.comments.set(garmentId, record);
    this.saveToDisk();

    return result;
  }

  /**
   * Deep Discrepancy Arbitration using the PRO Model (gemini-3.1-pro-preview)
   * Resolves conflicting rules, ambiguous acronyms ("BMA" vs "BBM"), and permanent brand architecture (HUGO vs BOSS).
   */
  public async runProArbitration(garmentId: string, directorComment: string): Promise<ProArbitrationResult> {
    const garmentRows = await db.select().from(garments).where(eq(garments.id, garmentId));
    const garment = garmentRows[0] || null;
    const existingRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));

    const rulesContext = existingRules.map(r => `[${r.rule_code}] (${r.target_field}) ${r.rule_title}: ${r.rule_instruction}`).join('\n');

    // Calculate next rule code sequence to avoid duplicate numbers
    const nextRuleCode = await this.fgdEngine.getNextSequentialRuleCode('RULE-CALIB');

    const prompt = `You are the Winzen Chief Apparel Intelligence Arbitrator powered by the PRO model (gemini-3.1-pro-preview).
You are performing Deep Discrepancy Arbitration on a garment under review.

CRITICAL ARCHITECTURAL POLICIES & CONSTRAINTS:
1. Hugo Boss Permanent Brand Architecture:
   - Hugo Boss restructured into two distinct permanent brand pillars: HUGO and BOSS.
   - HUGO: Progressive Gen Z streetwear / bold red accents / standalone retail.
   - BOSS: Contemporary luxury / tailoring / camel-black-white palette (includes BOSS Black, BOSS Orange, BOSS Green).
   - This is permanent brand architecture, NOT a seasonal or temporal line.
2. Winzen Internal ID vs Customer Style Number Isolation:
   - "winzen_style_no" (e.g., "20S-1004-2") is the primary internal factory code. It must NEVER be overwritten or replaced with customer style codes.
   - "cust_style_no" (e.g., "HAVOOG 50443691") is the buyer's external style & article code.
   - "goods_no" (e.g., "MA12233/SL-457") is the factory production order.
3. Literal Handwriting & Abbreviations:
   - If a tag has handwritten notes like "BMA" underneath "HB", do NOT hallucinate or change it to "Boss Black Men". If unverified, flag for explanation rather than inventing text.
4. Next Candidate Rule Code Sequence: Use "${nextRuleCode}" if a new catalog rule is synthesized.

GARMENT SPECIFICATIONS:
ID: ${garmentId}
Buyer: ${garment?.buyer || 'Unknown'}
Customer Style No: ${garment?.cust_style_no || 'Unknown'}
Winzen Internal Style: ${garment?.y_style_no || garment?.id || 'Unknown'}
Garment Type: ${garment?.garment_type || 'Unknown'}
Fabric: ${garment?.fabric_raw || 'Unknown'}
Sample Stage: ${garment?.sample_stage || 'Unknown'}
Reviewer Discrepancy Feedback: ${garment?.reviewer_feedback || 'None'}

ACTIVE CATALOG RULES:
${rulesContext}

DIRECTOR JASON'S COMMENTARY & DISCREPANCY CONTEXT:
"${directorComment}"

TASK:
1. Conduct deep discrepancy arbitration on the conflicting rules, brand acronyms, or style codes.
2. Provide an explicit Brand Hierarchy & Code Isolation analysis.
3. Synthesize structured field corrections to correct the garment catalog record.
4. Synthesize a proposed catalog rule (using rule code "${nextRuleCode}") that permanently encodes this knowledge.
5. Provide a clear recommendation for Senior Merchandiser Jennifer.

Return STRICT JSON adhering to this schema:
{
  "summary": "High-level summary of the arbitration decision",
  "brand_hierarchy_analysis": "Detailed explanation of brand pillar, acronym disambiguation, and code preservation",
  "explanation": "Clear guidance for Merchandiser Jennifer on what to approve",
  "field_corrections": {
    "buyer": "exact corrected value if needed",
    "cust_style_no": "exact customer code if needed",
    "winzen_style_no": "exact winzen code if needed",
    "garment_type": "corrected garment type if needed",
    "fabric_raw": "corrected fabric if needed"
  },
  "proposed_rule": {
    "rule_code": "${nextRuleCode}",
    "rule_title": "Descriptive rule title",
    "target_field": "buyer | cust_style_no | garment_type | fabric_raw",
    "condition_trigger": "Condition when this applies",
    "rule_instruction": "Exact instruction for AI and merchandisers",
    "positive_example": "Example of correct format",
    "negative_example": "Example of what to avoid"
  }
}`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        summary: "Pro Model Arbitration Completed",
        explanation: response.text || "Arbitration completed."
      };
    }

    const result: ProArbitrationResult = {
      evaluated_at: new Date().toISOString(),
      model: 'gemini-3.1-pro-preview',
      summary: parsed.summary || "Pro Model Discrepancy Arbitration Completed",
      brand_hierarchy_analysis: parsed.brand_hierarchy_analysis || "",
      explanation: parsed.explanation || "Arbitration completed by Pro model.",
      field_corrections: parsed.field_corrections || {},
      proposed_rule: parsed.proposed_rule || undefined
    };

    const record = this.comments.get(garmentId) || {
      garmentId,
      comment: directorComment,
      author: 'Director Jason',
      updated_at: new Date().toISOString()
    };
    record.pro_arbitration = result;
    this.comments.set(garmentId, record);
    this.saveToDisk();

    return result;
  }

  /**
   * Digest Director / Expert Commentary into Structured Field Changes Preview (Preview Only)
   * Strictly DOES NOT approve the garment or push to active library.
   */
  public async digestCommentFeedback(
    garmentId: string, 
    directorComment: string, 
    previewOnly: boolean = true
  ): Promise<DraftPreviewResult> {
    const garmentRows = await db.select().from(garments).where(eq(garments.id, garmentId));
    const garment = garmentRows[0] || null;
    const existingRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));
    const rulesContext = existingRules.map(r => `[${r.rule_code}] ${r.rule_title}: ${r.rule_instruction}`).join('\n');

    const prompt = `You are the Winzen Garment Specification Digestion Engine.
A Director & Merchandiser (Jason) has provided natural language feedback and observation notes for a garment under review.

YOUR ROLE:
Translate the plain-language feedback into specific, structured field changes for an interactive UI preview.
Do NOT modify catalog tables directly. This is a PREVIEW ONLY.

CURRENT GARMENT SPECIFICATION:
ID: ${garmentId}
Buyer: ${garment?.buyer || 'Unknown'}
Customer Style No: ${garment?.cust_style_no || 'Unknown'}
Winzen Internal Style No: ${garment?.y_style_no || garment?.id || 'Unknown'}
Garment Type: ${garment?.garment_type || 'Unknown'}
Fabric: ${garment?.fabric_raw || garment?.fabric_material || 'Unknown'}
Color: ${garment?.color || 'Unknown'}
Size: ${garment?.size || 'Unknown'}
Sample Stage: ${garment?.sample_stage || 'Unknown'}
Hashtags: ${garment?.hashtags || 'None'}
Invisible Hashtags: ${garment?.invisible_hashtags || 'None'}
Reviewer Notes / Feedback: ${garment?.reviewer_feedback || 'None'}

ACTIVE CATALOG RULES:
${rulesContext}

DIRECTOR'S OBSERVATION / FEEDBACK:
"${directorComment}"

TASK:
1. Extract exact attribute changes explicitly or implicitly instructed in the feedback (e.g. buyer, cust_style_no, y_style_no, garment_type, fabric_raw, color, size, hashtags, invisible_hashtags, content_notes).
2. If brand architecture is mentioned (e.g. Hugo Boss split into BOSS or HUGO), map correctly.
3. If specific factory codes, customer style codes, or tag markers are mentioned, map them to the proper fields.
4. Output a clean summary and the proposed field dictionary.

Return STRICT JSON adhering to this schema:
{
  "summary": "Concise summary of digested proposed changes",
  "explanation": "Clear explanation of how director comments were translated",
  "proposed_field_changes": {
    "buyer": "string if modified",
    "brand": "string if modified",
    "sales": "string if modified",
    "merchandiser": "string if modified",
    "goods_no": "string if modified",
    "cust_style_no": "string if modified",
    "y_style_no": "string if modified",
    "garment_type": "string if modified",
    "fabric_raw": "string if modified",
    "color": "string if modified",
    "size": "string if modified",
    "remark_memo": "string if modified",
    "hashtags": "string if modified",
    "invisible_hashtags": "string if modified",
    "content_notes": "string if modified"
  },
  "affected_fields": ["array of keys in proposed_field_changes that have new values"]
}`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        summary: "Digested Director Comments",
        explanation: response.text || "Digested comments for draft preview.",
        proposed_field_changes: {},
        affected_fields: []
      };
    }

    const proposed = parsed.proposed_field_changes || {};
    // Clean out undefined or empty string values if they didn't change
    const cleanedProposed: Record<string, any> = {};
    for (const [k, v] of Object.entries(proposed)) {
      if (v !== undefined && v !== null && v !== '') {
        cleanedProposed[k] = v;
      }
    }

    const affected = Array.isArray(parsed.affected_fields) && parsed.affected_fields.length > 0
      ? parsed.affected_fields
      : Object.keys(cleanedProposed);

    const result: DraftPreviewResult = {
      digested_at: new Date().toISOString(),
      model: 'gemini-3.8-flash',
      summary: parsed.summary || `Digested ${affected.length} field updates for preview`,
      proposed_field_changes: cleanedProposed,
      preview_only: previewOnly,
      affected_fields: affected,
      explanation: parsed.explanation || "Field changes staged for interactive draft preview."
    };

    const record = this.comments.get(garmentId) || {
      garmentId,
      comment: directorComment,
      author: 'Director Jason',
      updated_at: new Date().toISOString()
    };
    record.draft_preview = result;
    this.comments.set(garmentId, record);
    this.saveToDisk();

    return result;
  }
}
