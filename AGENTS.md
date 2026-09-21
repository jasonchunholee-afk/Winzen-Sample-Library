# SYSTEM DIRECTIVES & ARCHITECTURAL POLICIES

## 1. Zero Volatile State & Mandatory Durable Persistence Policy
* **CRITICAL INSTRUCTION**: Volatile in-memory-only storage for job states, analytical outputs, evaluation reports, batch test results, and user data is **strictly forbidden**.
* **Immediate Disk Persistence**: Every background worker, job manager, and calibration engine (`FgdJobManager`, etc.) must persist its state immediately to durable disk storage (`/data/*.json` or PostgreSQL database) upon creation or status update.
* **Process Restart Resilience**: All service singletons must hydrate their state from disk on startup and provide on-demand re-syncing (`forceReload`) so that server restarts, dev reloads, or container recycling never cause loss of user reports or historical data.
* **Never Repeat Volatile Memory Regressions**: Whenever an agent or service creates an asynchronous process or evaluation suite, disk serialization is mandatory before reporting completion to the client.

## 2. Sandbox Isolation & Explicit User Approval
* **Production Integrity**: Test suites, discrepancy engines, and automated calibration loops run strictly in sandbox mode.
* **No Unapproved Overwrites**: No production catalog records may be modified silently. All generated pattern calibrations or structural amendments must be presented for explicit user review and approval before being written to active catalog tables.

## 3. Merchandiser Natural Language First Workflow
* **Plain Language Guidance**: Merchandisers and domain experts provide observations in natural language commentary.
* **Automated Digestion & Translation**: The system must digest, synthesize, and translate plain-language feedback into structured rules (rule codes, target fields, condition triggers, directives, positive/negative examples).
* **Zero Cognitive Overhead**: Merchandisers must never be forced to navigate or fill out technical fields (condition triggers, code identifiers, raw syntax) manually. The AI digests and presents ready-to-approve rules.

## 4. Hugo Boss Permanent Brand Architecture Standard
* **Corporate Structure**: Hugo Boss restructured into two distinct permanent brand pillars: **HUGO** and **BOSS**.
* **Separate Retail & Demographics**: HUGO (progressive Gen Z streetwear / red accents / standalone retail stores) and BOSS (contemporary luxury / tailoring / camel-black-white palette, including lines BOSS Black, BOSS Orange, BOSS Green).
* **Permanent Architecture**: This corporate restructuring is permanent brand architecture, **NOT** a temporal or seasonal line. Always index accordingly.

## 5. Agent Interaction Syntax & Macros

### [Optimisation] / Optimisation
**Purpose:** Pre-execution analysis to prevent architectural mistakes and runtime bloat.
**Trigger Matching:** Flexible and forgiving. Triggers on `[Optimisation]`, `Optimisation`, `[Optimization]`, `Optimization` (case-insensitive, with or without square brackets), followed by optional `***` delimiters (closing `***` is strictly optional).
**Usage Examples:**
```text
[Optimisation]
***
<Feature Request>
***
```
*or simply:*
```text
optimisation
***
<Feature Request>
```
**Behavior:** The Agent must NOT write application code. It must return an Execution Strategy analyzing Agent Time estimates, App Runtime bloat risks (like DOM explosions), codebase refactor checks, and a "Prompt Splitting Strategy" (creating 2-4 distinct prompts for the user to paste back).

### [Re-optimisation] / Re-optimisation
**Purpose:** Iterative post-optimisation deliberation to refine plans, steer architectural direction, evaluate or select between presented alternative solutions, incorporate new feedback/ideas, and produce an updated execution strategy.
**Trigger Matching:** Flexible and forgiving. Triggers on `[Re-optimisation]`, `Re-optimisation`, `[Re-optimization]`, `Re-optimization`, `re-optimisation`, `re-optimization`, `reoptimisation`, `reoptimization` (case-insensitive, with or without square brackets, with or without hyphen), followed by optional `***` delimiters (closing `***` is strictly optional).
**Usage Examples:**
```text
[Re-optimisation]
***
<User feedback, added ideas, chosen solution direction, or architectural tweaks>
***
```
*or simply:*
```text
re-optimisation
***
<User feedback / new ideas>
```
**Behavior & Protocol:** The Agent must NOT write application code. It follows a 3-stage protocol:
1. **Optimise the User's New Input**: Critically digest the user's new thoughts, additions, or directional pivot. Stress-test the new ideas for architectural fit, runtime bloat risks, zero-volatile-state adherence, and implementation friction.
2. **Harmonized Analysis & Discussion**: Re-evaluate the solution in light of the new input, reconcile it with previously analyzed constraints, address trade-offs, and solidify the final technical direction.
3. **Calibrated Prompt Splitting Strategy**: Formulate and output a fresh, updated set of modular copy-paste execution prompts (typically 2–4 sequential prompts) ready for the user to trigger implementation.

### [Reflect] / Reflect
**Purpose:** Post-execution or post-analysis reflection to track latency discrepancies and refine execution strategies.
**Trigger Matching:** Flexible and forgiving. Triggers on `[Reflect]`, `Reflect`, `[reflect]`, `reflect` (with or without brackets), or natural language variations such as *"Reflect the difference between..."* or *"Reflect why the previous thread took so long..."*.
**Variant 1 (After an Optimisation prompt):** The Agent reflects on the difference between the predicted time and the actual analysis generation time, and recommends further optimization to the prompt or execution plan.
**Variant 2 (Standalone / After normal execution):** The Agent reflects on why the previous task/thread took so long and recommends further architectural or prompting optimizations.
**CRITICAL TIME TRACKING RULE:** As an LLM, the Agent does not have native access to exact wall-clock execution times for past turns. The Agent MUST NOT hallucinate or guess the actual time taken (e.g., inventing "90 seconds"). To reflect accurately, the Agent must rely strictly on execution times explicitly provided by the user. If the user does not provide the exact time, the Agent must focus the reflection purely on the *number of tool calls*, *failed edits*, and *architectural complexity* rather than inventing a numerical duration.

### Director: / [Director]
**Purpose:** Executive-level critique, quality enforcement, and oversight for garment digitization, FGD completeness, rule calibration, and catalog fidelity.
**Trigger Matching:** Flexible and forgiving. Triggers on `Director:`, `[Director]`, `Director -`, or `Director [GarmentID]`, followed by feedback, critique, or natural language directives.
**Protocol & Workflow:**
1. **Target Identification & Asset Retrieval**: Parse the target Garment ID (e.g. `20S-1004-2`) and retrieve all associated high-resolution visual archive assets (specifically the high-res AI buffer `/images_ai/` for factory label cards).
2. **Zero-Omission Invariant Enforcement**: Cross-examine all physical label zones (buyer header, brand sub-codes, personnel grid, goods number, memo/print block, approval stamps, inspector initials, handwritten dates/weights). Every mark must be captured without loss into formalized fields or `handwritten_notes`.
3. **Database Harmonization & Persistence**: Persist extracted fields immediately to durable PostgreSQL database storage (`brand_code`, `merchandiser`, `sales`, `goods_no`, `remark_memo`, `handwritten_notes`, `sample_stage`, `fabric_*`, etc.).
4. **Before-and-After Audit Diff**: Generate and output a transparent before-and-after audit diff comparing baseline values with the updated record, highlighting discovered data points and precision gains.

## 6. Token Governance & Session Guardrails (Mandatory)
* **The 20-Turn Rule & Chat Tracking**: To prevent runaway token consumption and token quota exhaustion, the Agent MUST append a discrete session counter at the very bottom of every single response:
  **`[Session Turn: X/20 | Status: Healthy]`**
* **Turn 18 Notice**: If Turn reaches 18, add:
  `⚠️ Approaching turn limit (18/20). Prepare to Remix to a fresh session after completing the current task.`
* **Turn 20 Alert**: If Turn reaches 20, add:
  `🛑 20-Turn limit reached. Please Remix now to reset context and prevent token quota lockout.`
* **Token-Optimized OO Architecture**:
  - Surgical file access: Only inspect exact requested classes or components (<300 lines per file).
  - Lean DTOs for AI Calls: Strip payloads to minimal necessary fields; never inject large base64 images or unneeded database rows into prompts.
  - Targeted Diffs: Use surgical edits instead of massive file rewrites.

