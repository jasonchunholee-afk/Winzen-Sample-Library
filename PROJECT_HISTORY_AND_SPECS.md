# Winzen Sample Library: Project History, Comprehensive Specifications & Decoupled Architecture Plan

> **Document Version:** 1.0.0  
> **Target Audience:** Claude Code, AI Studio Agents, Engineering Architects  
> **Core Objective:** Provide a complete historical, functional, and architectural blueprint of the Winzen Sample Library ecosystem to guide the transition into a **Decoupled Micro-Module Architecture**, slashing token burn by 80% and strictly enforcing sub-300-line modular encapsulation.

---

## Table of Contents
1. [Executive Summary & The Token Crisis](#1-executive-summary--the-token-crisis)
2. [Operational Personas & Authority Matrix](#2-operational-personas--authority-matrix)
3. [Chronological Project Milestones & Evolution](#3-chronological-project-milestones--evolution)
4. [Token Burn Analysis & Architectural Root Causes](#4-token-burn-analysis--architectural-root-causes)
5. [Decoupled Micro-Module Architecture Plan (`src/modules/`)](#5-decoupled-micro-module-architecture-plan-srcmodules)
6. [Work Volume Assessment (Past vs. Future Focus)](#6-work-volume-assessment-past-vs-future-focus)
7. [Live REST Bridge & Central Coordinator Hub](#7-live-rest-bridge--central-coordinator-hub)
8. [3-Tier Image Pipeline & Data Persistence Invariants](#8-3-tier-image-pipeline--data-persistence-invariants)
9. [API Contracts, Lifecycle States & Schemas](#9-api-contracts-lifecycle-states--schemas)
10. [Claude Reviewer Guidelines & Token-Optimization Playbook](#10-claude-reviewer-guidelines--token-optimization-playbook)

---

## 1. Executive Summary & The Token Crisis

The **Winzen Sample Library** is a digital garment archiving and quality control ecosystem built for **Winzen Apparel Limited**, a premier Hong Kong garment manufacturer. The system bridges physical garment samples, factory label card OCR, quality control triage, warehouse shelving, and executive discrepancy arbitration.

### The Problem: Monolithic Token Saturation
Historically, the application grew into a dense, full-stack monolith:
- `server.ts` expanded beyond **2,000 lines** (over 82 KB), containing storage migrations, OCR wrappers, warehouse shelving logic, capture ingestion routes, and database facades.
- Frontend components such as `Review.tsx` (743 lines), `GarmentDetail.tsx` (800+ lines), and `DeveloperOoDiagnostics.tsx` (1,000+ lines) frequently caused LLM context saturation, slow tool turnaround times, and severe token burn.
- Frequent prompt gymnastics and multi-turn debugging quickly exhausted the **20-turn session quota**, risking lockout and degradation.

### The Architectural Remedy
To slash token consumption by **80%**, the application is refactoring into:
1. **Satellite Applets via REST Bridges**: Decoupling camera hardware capture into an autonomous satellite applet (**Capture Station** at `https://ai.studio/apps/bf688cb8-b95b-47f3-920b-441a734e4f6d`) connected via a lightweight, mockable REST bridge (`CaptureBridge.ts`).
2. **Main as the Coordinator Hub**: Transforming Main into an event-driven orchestrator managing an explicit **Garment State Lifecycle Machine** (`EcosystemCoordinator.ts`).
3. **Strict Domain Micro-Modules (`src/modules/`)**: Isolating code into self-contained directories (`intake`, `qa-review`, `arbitration`, `catalog`) where each file is strictly capped under **300 lines**.

---

## 2. Operational Personas & Authority Matrix

The ecosystem serves four distinct personas with clear boundaries of authority:

| Persona | Role | Primary Interface | Authority & Business Rules |
| :--- | :--- | :--- | :--- |
| **Chen** | Photo Booth Operator | Capture Station (Satellite) | **Zero-Typing Workflow:** Never types garment codes. Scans barcodes or taps presets. **Zero-Authority:** Cannot rename catalog items or resolve duplicate naming collisions. Missing tags trigger `TEMP-YYYYMMDD-HHMMSS-XX` sticker barcodes. |
| **Jennifer** | Senior Technical Merchandiser | QA Lab (`Review.tsx` / `modules/qa-review/`) | **100% Approval Authority:** Reconciles OCR extracted specs against physical label cards. Resolves `cust_style_no` vs `winzen_style_no`. Flags poor/blurry photos with retake notices pushed to Chen. |
| **Rhoda** | Sample Retrieval Specialist | Search & Catalog (`Samples.tsx` / `modules/catalog/`) | **Zero-Hallucination Retrieval:** Multi-faceted label search mirroring physical tag geometry. Dropdowns dynamically populate *only* with existing catalog values. Fabric is split into Yarn Count, Material, and Construction. |
| **Director Jason** | Executive Director | Arbitration Suite (`modules/arbitration/`) | **Executive Oversight:** Arbitrates complex discrepancies between buyer tech packs and factory tags. Enforces permanent brand architecture (HUGO vs BOSS). Directs model governance (Gemini Flash vs Gemini Pro Deep Audit). |

---

## 3. Chronological Project Milestones & Evolution

### Phase 1: Inception & Label Card Emulation
- **Milestone:** Digitizing Winzen garment tags with physical tag layout fidelity.
- **Key Decision:** Strict anti-slop visual design—thick borders (`border-[3px] border-neutral-900`), mathematical emulation of printed manufacturing labels, and AI-inferred text distinguished in purple italics.
- **Storage:** Initial prototype stored data in a flat JSON file (`public/garments_data.json`).

### Phase 2: 3-Tier Photographic Pipeline
- **Milestone:** Resolving bandwidth, memory, and OCR legibility bottlenecks.
- **Key Decision:** Standardized on 3 explicit image tiers:
  - **`thumb/` (400px, 80% quality):** For zero-lag card grids, thumbnail filmstrips, and fast browsing.
  - **`ai/` (1024px, 85% quality):** For high-contrast vision model OCR and detailed label inspection.
  - **`raw/` (Original master archive, 10–30MB):** Preserved for high-resolution zoom, double-click lightboxes, and factory auditing.

### Phase 3: PostgreSQL Migration & Warehouse Topology
- **Milestone:** Moving from flat files to durable relational storage.
- **Key Decision:** PostgreSQL schema supporting garments, photographic shots, and warehouse locations. Implemented `OperationsEngine` and `WarehouseFacade` managing physical warehouse shelving, bins, containers, and capacity limits.

### Phase 4: Offline File System Sync & Quality Triage
- **Milestone:** Offline camera rig sync and automated image rejection.
- **Key Decision:**
  - **File System Access API (`FileSystemSyncService.ts`)**: Direct browser directory picking (`window.showDirectoryPicker`) and persistent directory handles stored in IndexedDB (`capture_studio_sync_db`).
  - **Automated Triage Gate (`CaptureAiInspector.ts`)**: Fast AI classification dividing incoming captures into **Set A** (Valid Garment/Label) and **Set B** (Empty table, floor, lens cap, severe blur -> Quarantined with `REJECTED_NO_GARMENT`).
  - **Catalog Isolation:** Quarantined Set B shots and provisional records are strictly blocked from active warehouse shelving and catalog searches.

### Phase 5: Satellite Decoupling & Central Coordinator Hub (Current)
- **Milestone:** Decoupling Capture Station to slash Main's token burn.
- **Key Decision:** Creation of `CaptureBridge.ts`, `EcosystemCoordinator.ts`, and `EcosystemDiagnostics.ts`. Main is now the orchestration hub; capture hardware operates in a dedicated satellite applet.

---

## 4. Token Burn Analysis & Architectural Root Causes

### Root Cause Analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MONOLITHIC TOKEN BURN CYCLE                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Large Files (>700-2000 lines)                                      │
│    └─► Reading 'server.ts' or 'Review.tsx' costs 5,000–12,000 tokens    │
│                                                                        │
│ 2. Context Window Saturation                                           │
│    └─► Rapidly consumes context limits within 6–8 conversational turns │
│                                                                        │
│ 3. Failed Surgical Edits                                               │
│    └─► LLMs hallucinate line numbers or target strings in huge files   │
│    └─► Retries and re-reading cause exponential token consumption      │
│                                                                        │
│ 4. 20-Turn Session Lockout                                             │
│    └─► Session reaches Turn 18-20, forcing disruptive applet remixes   │
└────────────────────────────────────────────────────────────────────────┘
```

### Quantitative Metrics of Files Requiring Decoupling
| File Path | Current Line Count | Primary Cause of Bloat | Refactor Strategy |
| :--- | :--- | :--- | :--- |
| `/server.ts` | **2,019 lines** | Monolithic routes, storage wrappers, inline handlers | Extract domain routers into `server/routes/` and services into `server/services/`. Keep `server.ts` < 200 lines. |
| `/src/components/DeveloperOoDiagnostics.tsx` | **1,000+ lines** | Embedded test runners, schema monitors, FGD tests | Split into sub-tabs under `src/components/developer/`. |
| `/src/components/GarmentDetail.tsx` | **800+ lines** | Label rendering, image lightbox, metadata forms | Separate into `LabelSpecCard`, `GarmentLightbox`, `SpecEditModal`. |
| `/src/components/Review.tsx` | **743 lines** | Dual-pane review, OCR diffing, merge tools | Delegate to `modules/qa-review/`. |
| `/src/components/Samples.tsx` | **450+ lines** | Filter logic, grid display, barcode generators | Delegate to `modules/catalog/`. |

---

## 5. Decoupled Micro-Module Architecture Plan (`src/modules/`)

The core architectural directive is to divide Main into **four domain micro-modules**. Every component or service in these modules must remain **under 300 lines of code**.

```
src/modules/
├── index.ts                      # Clean barrel exports
├── intake/                       # Intake & Normalization Micro-Module
│   ├── IntakeNormalizationEngine.ts
│   ├── BarcodeStagingHandler.ts
│   └── types.ts
├── qa-review/                    # Jennifer's QA Lab Micro-Module
│   ├── QaReviewEngine.ts
│   ├── SpecSheetDiffViewer.tsx
│   ├── StyleCodeMatcher.ts
│   └── types.ts
├── arbitration/                  # Director Jason's Executive Suite
│   ├── ArbitrationEngine.ts
│   ├── ModelTierGovernor.ts
│   ├── DiscrepancyResolver.ts
│   └── types.ts
└── catalog/                      # Official Archive & Query Engine
    ├── CatalogEngine.ts
    ├── MultiFacetFilter.ts
    ├── SpecSheetExporter.ts
    └── types.ts
```

### Detailed Micro-Module Responsibilities

#### 1. `modules/intake/` (Intake & Normalization)
- **Goal:** Ingest multi-shot payloads from the Capture Station bridge or local batch uploader.
- **Responsibilities:**
  - Validates payload structure (checks for mandatory Front and Label shots).
  - Detects temporary stickers (`TEMP-YYYYMMDD-HHMMSS-XX` vs permanent `WZ-*`).
  - Normalizes 3-tier image paths (`thumbUrl`, `aiUrl`, `rawUrl`).
  - Advances state: `CAPTURED` ➔ `INTAKE_VALIDATED`.

#### 2. `modules/qa-review/` (Jennifer's QA Lab)
- **Goal:** Provide a surgical quality review station without camera capture bloat.
- **Responsibilities:**
  - Compares OCR-extracted fields against physical macro label images.
  - Reconciles customer style numbers with Winzen factory codes (`cust_style_no` vs `winzen_style_no`).
  - Staging proposals (`QaReviewProposal`) with batch "Apply Approved Changes".
  - Outbound retake dispatch: pushes defective angles to Chen's station.
  - Advances state: `INTAKE_VALIDATED` ➔ `OCR_PARSED` ➔ `QA_PENDING` ➔ `CATALOG_PUBLISHED`.

#### 3. `modules/arbitration/` (Director Jason's Executive Suite)
- **Goal:** Executive oversight, discrepancy arbitration, and model tier control.
- **Responsibilities:**
  - Natural language directive capture: translates conversational guidance into formal rules without merchandiser cognitive overhead.
  - Model Tier Governance: Routes routine queries to **Gemini 2.5 Flash** and complex label discrepancies to **Gemini Pro Deep Audit**.
  - Enforces permanent brand architecture standards (HUGO vs BOSS).
  - Advances state: `QA_PENDING` ➔ `ARBITRATION_REQUIRED` ➔ `QA_PENDING` / `CATALOG_PUBLISHED`.

#### 4. `modules/catalog/` (Official Archive & Query Engine)
- **Goal:** Lightning-fast, multi-criteria exploration and export generation.
- **Responsibilities:**
  - High-performance filtering across seasons, buyers, fabrics, and warehouse bins.
  - Dynamic dropdown generation populated strictly with extant database values (zero hallucinated options).
  - Export generators: PDF, Excel, and JSON spec sheets.

---

## 6. Work Volume Assessment (Past vs. Future Focus)

To help Claude and incoming engineers allocate attention effectively, here is an audit of work volume across modules:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MODULE WORK VOLUME MATRIX                         │
├──────────────────────────┬───────────────────────┬─────────────────────┤
│ Module                   │ Past Work Completed   │ Future Effort Level │
├──────────────────────────┼───────────────────────┼─────────────────────┤
│ 1. Capture & Rig Sync    │ ██████████ (90%)      │ █░░░░░░░░░ (10%)    │
│ 2. Warehouse & Shelving  │ ████████░░ (80%)      │ ██░░░░░░░░ (20%)    │
│ 3. REST Bridge & Sentinel│ ███████░░░ (70%)      │ ███░░░░░░░ (30%)    │
│ 4. Intake Normalization  │ █████░░░░░ (50%)      │ █████░░░░░ (50%)    │
│ 5. QA Review (Jennifer)  │ ████░░░░░░ (40%)      │ ████████░░ (80%)    │
│ 6. Arbitration (Director)│ ███░░░░░░░ (30%)      │ █████████░ (90%)    │
│ 7. Monolith Decomposition│ ██░░░░░░░░ (20%)      │ ██████████ (100%)   │
└──────────────────────────┴───────────────────────┴─────────────────────┘
```

### High-Priority Focus for Claude / Incoming Developers:
1. **Monolith Decomposition (Highest Immediate Impact on Token Burn):**
   - Refactor `/server.ts` by delegating route groups into modular files.
   - Refactor `Review.tsx` into `modules/qa-review/`.
2. **Director Jason's Arbitration Suite (`modules/arbitration/`):**
   - Build UI for discrepancy resolution and model tier governance (Flash vs Pro).
3. **Jennifer's QA Lab Spec Diffs (`modules/qa-review/`):**
   - Connect staged proposals directly to `QaReviewEngine.ts`.

---

## 7. Live REST Bridge & Central Coordinator Hub

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│             CENTRAL COORDINATOR HUB (Winzen Main Applet)               │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 EcosystemCoordinator.ts                        │   │
│   │  - Garment Lifecycle State Machine                             │   │
│   │  - Type-Safe Event Dispatcher (on / off / dispatch)            │   │
│   └───────────────▲────────────────────────────────▲───────────────┘   │
│                   │                                │                   │
│         ┌─────────┴─────────┐            ┌─────────┴─────────┐         │
│         │ modules/intake/   │            │ modules/qa-review/│         │
│         └─────────▲─────────┘            └─────────┬─────────┘         │
│                   │ (Inbound Captures)             │ (Retake Flags)    │
│   ┌───────────────┴────────────────────────────────▼───────────────┐   │
│   │                    CaptureBridge.ts                            │   │
│   │  - Configurable CAPTURE_STATION_URL                            │   │
│   │  - Inbound Sync: syncPendingCaptures()                         │   │
│   │  - Outbound Feedback: sendRetakeNotice()                       │   │
│   └───────────────────────────────▲────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────┴────────────────────────────────┐   │
│   │             Server Proxy (/api/bridge/capture/*)               │   │
│   │  - Node native fetch proxy bypassing browser CORS restrictions │   │
│   └───────────────────────────────▲────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ REST (HTTP/JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               SATELLITE: Capture Station Applet                        │
│               URL: https://ai.studio/apps/bf688cb8-...                 │
│                                                                        │
│   - Canon EOS / WebRTC Hardware Control                                │
│   - Chen's Zero-Typing Workflow & Barcode Printing                     │
│   - Local 3-Tier Storage (raw/, ai/, thumb/)                           │
│   - Retake Queue Monitor                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Health Sentinel & Diagnostics (`EcosystemDiagnostics.ts`)
- **Probe Interval:** 30 seconds background polling.
- **Latency Classification:** `<300ms: Connected` | `>300ms: Degraded` | `Timeout/Err: Unreachable`.
- **Heap Budget Sentinel:** Node.js process heap monitored via `/api/diagnostics/sentinel`. Emits warnings at `>320MB` and critical alerts at `>350MB` to avoid container recycling.
- **Contract & Schema Validator:** Inspects JSON batches from satellite stations, enforcing mandatory angles (`Front`, `Label`) and barcode patterns.

---

## 8. 3-Tier Image Pipeline & Data Persistence Invariants

### 3-Tier Storage Architecture

| Tier | Folder Path | Dimension & Format | Purpose & Consumption |
| :--- | :--- | :--- | :--- |
| **Thumb** | `/images_thumb/` or `thumb/` | 400px width, 80% JPEG | Grid cards (`GarmentCard.tsx`), filmstrips, search results. Fast, smooth rendering without memory spikes. |
| **AI** | `/images_ai/` or `ai/` | 1024px width, 85% JPEG | Vision model OCR, label inspection, side-by-side spec comparison (`GarmentDetail.tsx`). |
| **Raw** | `/images/` or `raw/` | Original master (10–30MB) | Deep zoom, double-click lightbox, archival master, fabric weave audits. |

### Durable Persistence Invariants
- **Zero Volatile State Policy:** Storing job states, calibration logs, triage reports, or capture records in transient memory alone is strictly forbidden.
- **Instant Disk/DB Serialization:** All background processors (`CaptureTriageManager`, `FgdJobManager`) must persist state immediately to `/data/*.json` or PostgreSQL upon state change.
- **Container Cold-Start Resilience:** All service singletons must hydrate their state from disk during initialization (`forceReload`) to withstand container recycles.

---

## 9. API Contracts, Lifecycle States & Schemas

### Garment Lifecycle State Machine
```
[CAPTURED]
    │
    ▼
[INTAKE_VALIDATED] ──(Defective / Missing Angles)──► [RETAKE_REQUESTED]
    │                                                        │
    ▼                                                        │ (Re-shoot)
[OCR_PARSED]                                                 ▼
    │                                                   [CAPTURED]
    ▼
[QA_PENDING] ◄───────────────────────────────────────────────┐
    │                                                        │
    ├───(Discrepancy / Executive Policy)──► [ARBITRATION_REQUIRED]
    │                                                        │
    │◄──────────────(Directive Applied)──────────────────────┘
    │
    ▼
[CATALOG_PUBLISHED] ──(Reopened for Revision)──► [QA_PENDING]
```

### Core REST Endpoints

#### Bridge & Coordinator Endpoints
- `POST /api/bridge/capture/ping` — Probe Capture Station health and measure round-trip latency.
- `POST /api/bridge/capture/pending` — Fetch newly captured batches awaiting intake.
- `POST /api/bridge/capture/retake-flag` — Dispatch retake notice with failed angle criteria to Chen's station.
- `GET /api/diagnostics/sentinel` — Return Node.js memory footprint (`heapUsedMb`, `rssMb`, `status`).

#### Catalog & Garment Endpoints
- `GET /api/garments` — Retrieve active garments (automatically excludes quarantined Set B records).
- `GET /api/garments/:id` — Retrieve comprehensive garment record with 3-tier image URLs.
- `PUT /api/garments/:id` — Update garment specs (requires Jennifer QA or Director authorization).
- `POST /api/capture/triage-action` — Discard or force-override quarantined Set B captures.

---

## 10. Claude Reviewer Guidelines & Token-Optimization Playbook

When modifying, extending, or maintaining this codebase, **Claude and collaborating agents MUST adhere to these operational rules**:

### 1. The Sub-300-Line Rule
- **No single file may exceed 300 lines.** If a component or engine nears 280 lines, immediately break it down into modular sub-components, helper utilities, or separate hook files.

### 2. Surgical Context Inspection
- **Never call `view_file` on entire monolithic files** (e.g. reading all 2,000 lines of `server.ts`).
- Always use line slices (e.g. `StartLine=1920, EndLine=1950`) to inspect only the targeted function or route block.

### 3. Modularity First, Zero Slop
- When implementing new features, add them inside the appropriate micro-module under `src/modules/`:
  - New OCR or QA features ➔ `src/modules/qa-review/`
  - New arbitration or brand rules ➔ `src/modules/arbitration/`
  - New search, filtering, or exports ➔ `src/modules/catalog/`
  - Ingestion or barcode routines ➔ `src/modules/intake/`
- Avoid introducing generic SaaS templates, arbitrary glowing borders, or ungrounded mock placeholders.

### 4. Continuous Token Monitoring
- Every turn response must conclude with the discrete session turn counter:
  `[Session Turn: X/20 | Status: Healthy]`
- If turn reaches 18, prepare the handoff package for remixing.

---

*Authored for the Winzen Sample Library Engineering Team & Claude Review.*
