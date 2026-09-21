/**
 * src/modules/index.ts
 * 
 * Central registry for isolated domain micro-modules:
 * - Intake & Normalization
 * - QA Review Lab
 * - Director Arbitration Suite
 * - Official Catalog Engine
 */

export * from './intake/IntakeNormalizationEngine';
export * from './qa-review/QaReviewEngine';
export * from './arbitration/ArbitrationEngine';
export * from './catalog/CatalogEngine';
