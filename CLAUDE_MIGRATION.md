# Winzen Sample Library - Migration & Architecture Guide

## Overview
This document serves as a comprehensive handoff guide for transitioning the Winzen Sample Library platform to Claude Code. The application is a digital archiving tool built with React, Vite, Tailwind CSS, and a Node.js/Express backend, designed to digitize physical garment samples and their manufacturing labels.

## User Personas & Workflows
The architecture is designed around three specific operational roles:
1. **Chen (Capture):** Responsible for photographing physical garments. Chen uses the **Bulk Uploader**, which processes images sequentially via an Express backend to prevent memory overloads. 
2. **Jennifer (Review):** Responsible for quality control and label verification. Jennifer reviews the AI-extracted data against the physical label photos. The UI is strictly designed to mirror the physical layout of a Winzen Apparel Limited tag.
3. **Rhoda (Samples):** Responsible for retrieving historical data. Rhoda uses the **Advanced Label Search**, which features a grid mimicking the physical label. Every field is an interactive dropdown populated dynamically based *only* on existing database values, with Fabric intelligently split into *Yarn Count*, *Material*, and *Construction*.

## Image Processing Pipeline
When Chen uploads images via the Bulk Uploader, the Node.js backend (`server.ts`) processes them using `multer` and `sharp`:
* **Raw:** Original images are saved to `public/images/`.
* **Thumbnails:** Compressed to 400px (80% quality) and saved to `public/images_thumb/` for fast grid rendering.
* **AI Processing:** Compressed to 1024px (85% quality) and saved to `public/images_ai/` for vision model analysis.
* **Collision Handling:** If an image is uploaded with a duplicate filename (e.g., re-uploading a garment), the backend automatically appends a timestamp to preserve both versions.

## UI / UX Design Philosophy
* **Strict Anti-Slop:** The application avoids generic "SaaS" aesthetics. The `GarmentDetail` and `Samples` grid layouts use thick borders (`border-[3px] border-neutral-900`) and tight 1px gaps to mathematically emulate a printed manufacturing label.
* **AI Estimation Tracking:** If the AI infers a blank field from the photo (e.g., guessing Color or estimating Weight), it highlights the text in purple italics to distinguish it from verified label text.
* **Archival Summary:** Replaces any offensive or threatening internal nomenclature (like "AI Emulator"). It safely stores the baseline qualitative visual description of the garment.
* **Interactive Elements:** Features like the physical barcode are recreated faithfully; clicking the barcode placeholder generates a functional, scannable CODE128 barcode using `react-barcode`.

## REQUIRED MIGRATION TASK: Database Architecture Refactor
Currently, the system reads from a flat `public/garments_data.json` file and infers images by scanning directories. For the next phase of development, **you must migrate this to a true relational SQLite database.**

Please execute the following structural changes:
1. Create a SQLite `Garments` table and an `Images` table.
2. When an image is uploaded, insert a row into the `Images` table pointing to the corresponding garment ID.
3. Add a `default_front_image_id` column on the `Garments` table.
4. Build a UI toggle in `GarmentDetail.tsx` that updates that column in the database when Jennifer selects her preferred photo (this is necessary to handle duplicate garment uploads where multiple 'front' photos might exist).

## AI Integration & Environment Variables
The AI Studio environment natively provided a Gemini API key. When running this locally, you MUST recreate the AI extraction pipeline using a `.env` file.
1. Ensure `dotenv` is configured in `server.ts`.
2. The user will provide a `GEMINI_API_KEY` (or Anthropic API Key) in their local `.env` file.
3. Migrate the AI extraction logic (currently sitting in `scripts/analyzeGarments.js`) directly into the Express backend.
4. Workflow: When Chen uploads an image, the backend should save it, update the SQLite DB to "Pending AI", and asynchronously trigger the vision API to extract the label data and update the database row.

## Quality Control Feedback
A new UI section has been added to `GarmentDetail.tsx` called "Reviewer Notes & Feedback" (controlled by a `feedback` text area).
1. When migrating to the SQLite architecture, you MUST add a `reviewer_feedback` (TEXT) column to the `Garments` table.
2. The "Approve & Save" and "Flag Issue" buttons in `GarmentDetail.tsx` should execute a `PUT` request to save this text field back to the SQLite database so Rhoda can see the QC notes in the search view.
