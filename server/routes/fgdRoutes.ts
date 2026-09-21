import { Router } from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { db } from "../../src/db/index.ts";
import { labeling_rules, garments, images, fgd_observations, fgd_reports } from "../../src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { FgdEngine } from "../services/FgdEngine.ts";
import { FgdJobManager } from "../services/FgdJobManager.ts";

export function createFgdRouter(fgdEngine: FgdEngine): Router {
  const router = Router();
  const fgdJobManager = FgdJobManager.getInstance();

  // 1. Get currently active background job and saved reports
  router.get("/job/active", async (req, res) => {
    try {
      const activeJob = fgdJobManager.getActiveJob();
      const savedReports = await fgdJobManager.getSavedReports();
      res.json({ activeJob, savedReports });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to query active job" });
    }
  });

  // 1b. Get all saved reports from disk
  router.get("/reports", async (req, res) => {
    try {
      const reports = await fgdJobManager.getSavedReports(true);
      res.json({ reports });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch saved reports" });
    }
  });

  // 1c. Get garments that have never had an FGD run
  router.get("/garments-without-fgd", async (req, res) => {
    try {
      const allGarments = await db.select().from(garments);
      const allReports = await db.select({ id: fgd_reports.id, report_data: fgd_reports.report_data }).from(fgd_reports);
      
      const reportedGarmentIds = new Set<string>();
      for (const rep of allReports) {
        try {
          const parsed = JSON.parse(rep.report_data);
          if (parsed && parsed.garment_id) {
            reportedGarmentIds.add(parsed.garment_id);
          }
        } catch {}
      }

      // Also cross-reference in-memory savedReports
      const savedReports = await fgdJobManager.getSavedReports();
      for (const rep of savedReports) {
        if (rep && rep.garment_id) {
          reportedGarmentIds.add(rep.garment_id);
        }
      }

      const unanalyzedGarments = allGarments.filter(g => !reportedGarmentIds.has(g.id));

      res.json({
        count: unanalyzedGarments.length,
        totalGarments: allGarments.length,
        garmentsWithFgdCount: reportedGarmentIds.size,
        garmentIds: unanalyzedGarments.map(g => g.id),
        garments: unanalyzedGarments.map(g => ({
          id: g.id,
          buyer: g.buyer || '',
          season: g.season || '',
          garment_type: g.garment_type || '',
          status: g.status,
          description: g.description || ''
        }))
      });
    } catch (err: any) {
      console.error("[FGD Test] Garments without FGD query error:", err);
      res.status(500).json({ error: err?.message || "Failed to query garments without FGD" });
    }
  });

  // 2. Start autonomous test suite in background worker thread
  router.post("/job/start", async (req, res) => {
    try {
      const { garmentId, garmentIds, maxLoops = 2, isReviewRun = false, onlyUnderReview = false } = req.body;
      const isReviewMode = isReviewRun || onlyUnderReview;

      let targetIds: string[] = Array.isArray(garmentIds) && garmentIds.length > 0 
        ? garmentIds 
        : (garmentId ? [garmentId] : ['11S-1906', '13S-1060']);

      // "Re-run FGD for garments under review" Invariants:
      // Target ONLY garments with status === 'under_review' when onlyUnderReview is explicitly requested.
      if (onlyUnderReview) {
        const underReviewRows = await db.select({ id: garments.id })
          .from(garments)
          .where(eq(garments.status, 'under_review'));
        const underReviewSet = new Set(underReviewRows.map(r => r.id));

        if (Array.isArray(garmentIds) && garmentIds.length > 0) {
          targetIds = garmentIds.filter(id => underReviewSet.has(id));
        } else if (garmentId) {
          targetIds = underReviewSet.has(garmentId) ? [garmentId] : [];
        } else {
          targetIds = underReviewRows.map(r => r.id);
        }

        if (targetIds.length === 0) {
          return res.status(400).json({ 
            error: "No garments with status 'under_review' found to evaluate. All approved garments are strictly excluded." 
          });
        }
      }

      const job = fgdJobManager.startJob(
        targetIds, 
        isReviewMode ? 1 : (Number(maxLoops) || 2),
        { isReviewRun: isReviewMode }
      );
      res.json({
        success: true,
        message: isReviewMode 
          ? `Review evaluation suite started for ${targetIds.length} garments under review (1 Loop, candidate rules disabled).`
          : "FGD test suite started in background worker thread",
        job
      });
    } catch (err: any) {
      console.error("[FGD Job Start Error]", err);
      res.status(400).json({ error: err?.message || "Failed to start background test job" });
    }
  });

  // 3. Query status & live logs of background job
  router.get("/job/status", (req, res) => {
    try {
      const jobId = req.query.jobId as string;
      const job = jobId ? fgdJobManager.getJob(jobId) : fgdJobManager.getActiveJob();
      if (!job) {
        return res.json({ job: null, status: 'idle' });
      }
      res.json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch job status" });
    }
  });

  // 4. Cancel background job
  router.post("/job/cancel", (req, res) => {
    try {
      const { jobId } = req.body;
      const cancelled = fgdJobManager.cancelJob(jobId);
      res.json({ success: cancelled });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to cancel job" });
    }
  });

  // 5. Library garments listing
  router.get("/library-garments", async (req, res) => {
    try {
      const allGarments = await db.select().from(garments);
      const allImages = await db.select({ 
        id: images.id, 
        garment_id: images.garment_id,
        role: images.role,
        filename: images.filename
      }).from(images);

      // Pre-group DB images by garment_id to avoid N+1 queries
      const dbImagesByGarment = new Map<string, Array<{ filename: string; role: string }>>();
      for (const img of allImages) {
        if (!img.garment_id) continue;
        if (!dbImagesByGarment.has(img.garment_id)) {
          dbImagesByGarment.set(img.garment_id, []);
        }
        dbImagesByGarment.get(img.garment_id)!.push({
          filename: img.filename || `${img.garment_id}_${img.role || 'Image'}.jpg`,
          role: img.role || 'Label'
        });
      }

      const readyGarments = allGarments.map(g => {
        const diskImages = fgdEngine.getGarmentImagesFromDisk(g.id);
        const dbImgs = dbImagesByGarment.get(g.id) || [];
        const effectiveImages = diskImages.length > 0 ? diskImages : dbImgs;
        return {
          id: g.id,
          buyer: g.buyer || '',
          garment_type: g.garment_type || '',
          status: g.status,
          imageCount: Math.max(dbImgs.length, diskImages.length),
          images: effectiveImages.map(d => `${d.filename} (${d.role})`)
        };
      }).filter(g => g.imageCount > 0);

      res.json(readyGarments);
    } catch (err: any) {
      console.error("[FGD Test] Library garments error:", err);
      // Resilient fallback: scan local images directory so FGD test suite remains operational even during DB reconnects
      try {
        const imagesDir = path.join(process.cwd(), 'images');
        if (fs.existsSync(imagesDir)) {
          const files = fs.readdirSync(imagesDir);
          const garmentMap = new Map<string, string[]>();
          for (const f of files) {
            const m = f.match(/^([A-Za-z0-9_-]+?)(?:[ _-](?:\(?F\)?|\(?B\)?|Front|Back|Label|spec))?\.jpe?g$/i);
            if (m) {
              const gid = m[1].replace(/[-_](Front|Back|Label|F|B)$/i, '');
              if (!garmentMap.has(gid)) garmentMap.set(gid, []);
              garmentMap.get(gid)!.push(f);
            }
          }
          const diskGarments = Array.from(garmentMap.entries()).map(([id, flist]) => ({
            id,
            buyer: 'Winzen Archive',
            garment_type: 'Sample Garment',
            status: 'archived',
            imageCount: flist.length,
            images: flist
          }));
          return res.json(diskGarments);
        }
      } catch (fallbackErr) {
        console.error("[FGD Test] Fallback disk scan error:", fallbackErr);
      }
      res.status(500).json({ error: err?.message || "Failed to list library garments" });
    }
  });

  // Synchronous run fallback
  router.post("/run", async (req, res) => {
    try {
      const { garmentId, garmentIds, maxLoops = 2 } = req.body;
      const targetIds: string[] = Array.isArray(garmentIds) && garmentIds.length > 0 
        ? garmentIds 
        : (garmentId ? [garmentId] : ['11S-1906', '13S-1060']);

      const reports = [];
      for (const id of targetIds) {
        const report = await fgdEngine.runGarmentTest(id, Number(maxLoops) || 2);
        reports.push(report);
      }

      res.json({
        success: true,
        tested_count: reports.length,
        reports
      });
    } catch (err: any) {
      console.error("[FGD Test Runner Error]", err);
      res.status(500).json({ error: err?.message || "Failed to run FGD test suite" });
    }
  });

  // Re-run single garment FGD extraction in-place
  router.post("/run-single-test", async (req, res) => {
    try {
      const { garmentId, updateGarment = true } = req.body;
      if (!garmentId) {
        return res.status(400).json({ error: "garmentId is required to re-run FGD" });
      }

      // Clear OCR cache to force fresh Zero-Omission vision extraction
      fgdEngine.clearGarmentOcrCache(garmentId);

      // Execute 1-loop evaluation
      const report = await fgdEngine.runGarmentTest(garmentId, 1, undefined, { isReviewRun: true });

      const freshFgd = report.loops?.[0]?.fresh_fgd;
      let updatedGarment: any = null;

      if (freshFgd && updateGarment) {
        const label = freshFgd.label || {};
        const updates: any = {};
        if (label.buyer) updates.buyer = label.buyer;
        if (label.brand_code) updates.brand_code = label.brand_code;
        if (label.season) updates.season = label.season;
        if (label.sales) updates.sales = label.sales;
        if (label.merchandiser) updates.merchandiser = label.merchandiser;
        if (label.cust_style_no) updates.cust_style_no = label.cust_style_no;
        if (label.y_style_no) updates.y_style_no = label.y_style_no;
        if (label.goods_no) updates.goods_no = label.goods_no;
        if (label.sample_job_no) updates.sample_job_no = label.sample_job_no;
        if (label.sample_stage) updates.sample_stage = label.sample_stage;
        if (label.garment_type) updates.garment_type = label.garment_type;
        if (label.washing) updates.washing = label.washing;
        if (label.fabric_raw) updates.fabric_raw = label.fabric_raw;
        if (label.fabric_material) updates.fabric_material = label.fabric_material;
        if (label.fabric_yarn_count) updates.fabric_yarn_count = label.fabric_yarn_count;
        if (label.fabric_construction) updates.fabric_construction = label.fabric_construction;
        if (label.color) updates.color = label.color;
        if (label.size) updates.size = label.size;
        if (label.gnw_weight) updates.gnw_weight = label.gnw_weight;
        if (label.remark_memo) updates.remark_memo = label.remark_memo;
        if (label.handwritten_notes) updates.handwritten_notes = label.handwritten_notes;
        if (freshFgd.garment_description) updates.description = freshFgd.garment_description;
        if (Array.isArray(freshFgd.hashtags) && freshFgd.hashtags.length > 0) {
          updates.hashtags = freshFgd.hashtags.join(', ');
        }

        if (Object.keys(updates).length > 0) {
          await db.update(garments).set(updates).where(eq(garments.id, garmentId));
        }

        // Fetch refreshed record
        const gRows = await db.select().from(garments).where(eq(garments.id, garmentId));
        updatedGarment = gRows[0] || null;
      }

      // Save report in FgdJobManager
      try {
        await fgdJobManager.saveReportsToDisk([report]);
      } catch (saveErr) {
        console.warn("[run-single-test] Warning saving report:", saveErr);
      }

      res.json({
        success: true,
        report,
        freshFgd,
        garment: updatedGarment,
        message: `Successfully re-ran FGD extraction for ${garmentId}`
      });
    } catch (err: any) {
      console.error("[FGD Run Single Test Error]", err);
      res.status(500).json({ error: err?.message || "Failed to re-run single garment FGD" });
    }
  });

  // Apply single rule with atomic transaction
  router.post("/apply-rule", async (req, res) => {
    try {
      const { rule } = req.body;
      if (!rule || !rule.rule_code || !rule.rule_title || !rule.condition_trigger || !rule.rule_instruction) {
        return res.status(400).json({ error: "Missing required rule fields" });
      }

      const sourceFeedback = rule.user_comment
        ? `${rule.source_feedback || 'FGD Test Mode'} | Note: ${rule.user_comment}`
        : (rule.source_feedback || 'FGD Test Mode');

      await db.transaction(async (tx) => {
        const existing = await tx.select().from(labeling_rules).where(eq(labeling_rules.rule_code, rule.rule_code));
        if (existing.length > 0) {
          await tx.update(labeling_rules).set({
            rule_type: rule.rule_type || 'positive',
            target_field: rule.target_field || 'garment_description',
            rule_title: rule.rule_title,
            condition_trigger: rule.condition_trigger,
            rule_instruction: rule.rule_instruction,
            example_positive: rule.example_positive || '',
            example_negative: rule.example_negative || '',
            source_feedback: sourceFeedback,
            is_active: true,
            updated_at: new Date()
          }).where(eq(labeling_rules.rule_code, rule.rule_code));
        } else {
          await tx.insert(labeling_rules).values({
            rule_code: rule.rule_code,
            rule_type: rule.rule_type || 'positive',
            target_field: rule.target_field || 'garment_description',
            rule_title: rule.rule_title,
            condition_trigger: rule.condition_trigger,
            rule_instruction: rule.rule_instruction,
            example_positive: rule.example_positive || '',
            example_negative: rule.example_negative || '',
            source_feedback: sourceFeedback,
            is_active: true
          });
        }
      });

      res.json({ success: true, message: `Successfully applied rule ${rule.rule_code}` });
    } catch (err: any) {
      console.error("[Apply Rule Error]", err);
      res.status(500).json({ error: err?.message || "Failed to apply rule" });
    }
  });

  // Digest commentary
  router.post("/digest-commentary", async (req, res) => {
    try {
      const { userComment, garmentId, existingRule, diffsSummary } = req.body;
      if (!userComment || typeof userComment !== 'string' || !userComment.trim()) {
        return res.status(400).json({ error: "Commentary text is required" });
      }

      const rules = await fgdEngine.digestCommentaryIntoRules({
        userComment: userComment.trim(),
        garmentId,
        existingRule,
        diffsSummary
      });

      res.json({
        success: true,
        digestedRules: rules,
        count: rules.length
      });
    } catch (err: any) {
      console.error("[Digest Commentary Error]", err);
      res.status(500).json({ error: err?.message || "Failed to digest commentary into rules" });
    }
  });

  // Approve AI deduction with atomic database transaction
  router.post("/approve-ai-deduction", async (req, res) => {
    try {
      const { rule, userComment, garmentId, customerName, scope, aiDeduction } = req.body;
      if (!rule || !rule.rule_code) {
        return res.status(400).json({ error: "Rule payload is required" });
      }

      const ruleCode = rule.rule_code;
      const isHugoBoss = customerName === 'HUGO BOSS' || /hugo|boss/i.test(rule.rule_title) || /hugo|boss/i.test(rule.rule_instruction) || /hugo|boss/i.test(userComment || '');
      const determinedScope = scope || (isHugoBoss ? 'customer_specific' : 'global');
      const determinedCustomer = customerName || (isHugoBoss ? 'HUGO BOSS' : 'GENERAL');

      let finalTitle = rule.rule_title;
      let finalInstruction = rule.rule_instruction;
      let finalTrigger = rule.condition_trigger;
      let finalPositive = rule.example_positive || '';
      let finalNegative = rule.example_negative || '';

      if (isHugoBoss && (rule.target_field === 'buyer' || !rule.target_field)) {
        finalTitle = "Hugo Boss Permanent Brand Architecture (HUGO vs BOSS)";
        finalTrigger = "Label identifies Hugo Boss / HB, or displays 'HUGO' or 'BOSS' typography.";
        finalInstruction = "Classify into the permanent brand architecture: 'HUGO' (Gen Z / progressive streetwear / red logo / standalone retail stores) or 'BOSS' (contemporary luxury / tailoring / camel-black-white branding, including sub-lines BOSS Black, BOSS Orange, BOSS Green). This corporate restructuring is permanent brand architecture, NOT a temporal line.";
        finalPositive = "BOSS (or HUGO)";
        finalNegative = "HB (Hugo Boss) (omitting permanent brand pillar)";
      }

      const sourceFeedback = `[${determinedScope.toUpperCase()}: ${determinedCustomer}] ${userComment || rule.source_feedback || 'AI Calibrated Deduction'}`;

      // Atomic DB transaction
      await db.transaction(async (tx) => {
        const existing = await tx.select().from(labeling_rules).where(eq(labeling_rules.rule_code, ruleCode));
        if (existing.length > 0) {
          await tx.update(labeling_rules).set({
            rule_type: rule.rule_type || 'positive',
            target_field: rule.target_field || 'buyer',
            rule_title: finalTitle,
            condition_trigger: finalTrigger,
            rule_instruction: finalInstruction,
            example_positive: finalPositive,
            example_negative: finalNegative,
            source_feedback: sourceFeedback,
            is_active: true,
            updated_at: new Date()
          }).where(eq(labeling_rules.rule_code, ruleCode));
        } else {
          await tx.insert(labeling_rules).values({
            rule_code: ruleCode,
            rule_type: rule.rule_type || 'positive',
            target_field: rule.target_field || 'buyer',
            rule_title: finalTitle,
            condition_trigger: finalTrigger,
            rule_instruction: finalInstruction,
            example_positive: finalPositive,
            example_negative: finalNegative,
            source_feedback: sourceFeedback,
            is_active: true
          });
        }
      });

      // Persist full observation to PostgreSQL
      const obsId = `OBS-${determinedCustomer.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const newObs = {
        id: obsId,
        item_code: garmentId || 'GENERAL',
        observation_text: userComment || rule.user_comment || finalInstruction,
        submitted_by: determinedCustomer || 'Jennifer',
        timestamp: new Date()
      };
      await db.insert(fgd_observations).values(newObs);

      res.json({
        success: true,
        ruleCode,
        scope: determinedScope,
        customer: determinedCustomer,
        observationId: obsId,
        outcomeSummary: `Successfully approved & activated rule ${ruleCode} in rules catalog for ${determinedCustomer}. You can approve all rules first, then click "Re-run FGD for garments under review" at the top when ready.`
      });
    } catch (err: any) {
      console.error("[Approve AI Deduction Error]", err);
      res.status(500).json({ error: err?.message || "Failed to approve AI deduction" });
    }
  });

  // Conversational recorrection & dialogue
  router.post("/recorrect-deduction", async (req, res) => {
    try {
      const { feedback, currentRule, currentDeduction, garmentId } = req.body;
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ error: "Feedback is required" });
      }

      const prompt = `You are a Senior Knowledge & Domain Engineering AI for Winzen Apparel catalog curation.
You are in a direct conversational consultation thread with a merchandiser/expert who is reviewing an AI pattern deduction.

CURRENT DEDUCTION & RULE CONTEXT:
- Garment ID: ${garmentId || 'Catalog Sample'}
- Rule Code: ${currentRule?.rule_code || 'RULE-CALIB-01'}
- Current Title: ${currentRule?.rule_title || 'N/A'}
- Current Trigger: ${currentRule?.condition_trigger || 'N/A'}
- Current Directive: ${currentRule?.rule_instruction || 'N/A'}
- Current Deduction Summary: ${currentDeduction || 'N/A'}

MERCHANDISER RECORRECTION / FEEDBACK:
"${feedback}"

YOUR TASK:
Respond to the merchandiser just like Gemini in a collaborative thread:
1. Acknowledge and validate their feedback.
2. Explain the revised deduction and how it applies to this customer or across garments.
3. Provide the adjusted structured rule fields (title, condition_trigger, rule_instruction, example_positive, example_negative).
4. Provide a clear recommendation and outline the exact outcome if they approve.

CRITICAL INSTRUCTION FOR HUGO BOSS:
If Hugo Boss is referenced, strictly respect that HUGO and BOSS are permanent brand pillars (HUGO = progressive Gen Z streetwear / red accents; BOSS = contemporary luxury / tailoring / camel-black-white). This is permanent brand architecture, NOT a temporal line.

Return ONLY a JSON object:
{
  "conversational_response": "Your friendly, professional response directly to the merchandiser explaining what you adjusted and why...",
  "ai_deduction": "Concise revised pattern deduction summary",
  "scope": "customer_specific",
  "customer": "string or GENERAL",
  "updated_rule": {
    "rule_title": "string",
    "condition_trigger": "string",
    "rule_instruction": "string",
    "example_positive": "string",
    "example_negative": "string",
    "target_field": "string"
  },
  "recommendation": "Recommended: Approve & Apply. Explain what clicking will do..."
}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        ...parsed
      });
    } catch (err: any) {
      console.error("[Recorrect Deduction Error]", err);
      res.status(500).json({ error: err?.message || "Failed to process recorrection with AI" });
    }
  });

  // 9. Fetch Stored Merchandiser Observations
  router.get("/observations", async (req, res) => {
    try {
      const rows = await db.select().from(fgd_observations);
      
      const obs = rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp?.toISOString() || new Date().toISOString(),
        customer: r.submitted_by,
        scope: 'global',
        garment_ids: [r.item_code],
        raw_commentary: r.observation_text,
        ai_deduction: 'Deducted pattern',
        status: 'approved',
        associated_rule_code: ''
      }));
      
      return res.json({ observations: obs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load observations" });
    }
  });

  // 10. Request revision for an approved garment (resets status to 'Revision Requested' or 'Pending Approval')
  router.post("/garment/:id/request-revision", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = "Revision requested via FGD Test Mode" } = req.body;

      const existing = await db.select().from(garments).where(eq(garments.id, id));
      if (existing.length === 0) {
        return res.status(404).json({ error: `Garment ${id} not found` });
      }

      await db.update(garments).set({
        status: 'Revision Requested',
        reviewer_feedback: reason
      }).where(eq(garments.id, id));

      res.json({
        success: true,
        message: `Garment ${id} status updated to 'Revision Requested'.`,
        garmentId: id,
        newStatus: 'Revision Requested'
      });
    } catch (err: any) {
      console.error("[FGD Revision Request Error]", err);
      res.status(500).json({ error: err?.message || "Failed to request garment revision" });
    }
  });

  // 11. Fetch all labeling rules with active status from database
  router.get("/rules", async (req, res) => {
    try {
      const allRules = await db.select().from(labeling_rules).orderBy(desc(labeling_rules.updated_at));
      const activeRuleCodes = allRules.filter(r => r.is_active).map(r => r.rule_code);
      res.json({
        success: true,
        rules: allRules,
        activeRuleCodes,
        total: allRules.length,
        activeCount: activeRuleCodes.length
      });
    } catch (err: any) {
      console.error("[FGD Fetch Rules Error]", err);
      res.status(500).json({ error: err?.message || "Failed to fetch labeling rules" });
    }
  });

  // 12. Recall/Unarchive rule (reopen for modification or review)
  router.post("/unapply-rule", async (req, res) => {
    try {
      const { ruleCode } = req.body;
      if (!ruleCode) {
        return res.status(400).json({ error: "ruleCode is required" });
      }

      await db.update(labeling_rules)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(labeling_rules.rule_code, ruleCode));

      res.json({
        success: true,
        message: `Rule ${ruleCode} recalled from active archive and reopened for review.`,
        ruleCode,
        is_active: false
      });
    } catch (err: any) {
      console.error("[FGD Unapply Rule Error]", err);
      res.status(500).json({ error: err?.message || "Failed to recall rule" });
    }
  });

  // 13. Reapply/Re-archive rule
  router.post("/reapply-rule", async (req, res) => {
    try {
      const { ruleCode } = req.body;
      if (!ruleCode) {
        return res.status(400).json({ error: "ruleCode is required" });
      }

      await db.update(labeling_rules)
        .set({ is_active: true, updated_at: new Date() })
        .where(eq(labeling_rules.rule_code, ruleCode));

      res.json({
        success: true,
        message: `Rule ${ruleCode} archived and active in Rules DB.`,
        ruleCode,
        is_active: true
      });
    } catch (err: any) {
      console.error("[FGD Reapply Rule Error]", err);
      res.status(500).json({ error: err?.message || "Failed to reapply rule" });
    }
  });

  // 14. Wipe out pending unapproved rules from last round or specified scope
  router.post("/rules/wipe-pending", async (req, res) => {
    try {
      const { scope, garmentId } = req.body || {};
      const result = await fgdJobManager.wipePendingRules({ scope, garmentId });
      res.json({
        success: true,
        message: result.wipedCount > 0
          ? `Successfully wiped ${result.wipedCount} pending rule(s) across ${result.affectedGarmentIds.length} garment(s).`
          : "No pending rules found to wipe.",
        ...result
      });
    } catch (err: any) {
      console.error("[FGD Wipe Pending Rules Error]", err);
      res.status(500).json({ error: err?.message || "Failed to wipe pending rules" });
    }
  });

  return router;
}
