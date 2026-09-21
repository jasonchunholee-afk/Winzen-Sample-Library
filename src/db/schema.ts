/**
 * Winzen Sample Library - Modular Database Schema
 * 
 * Re-exports all table schemas and relations from domain-specific modules:
 * - ./schema/users: User accounts & auth mappings
 * - ./schema/garments: Garment entities, photography views, summaries, and change requests
 * - ./schema/rules: Calibrated labeling & deduction rules
 * - ./schema/abbreviations: Textile abbreviation & translation dictionary
 */

export * from './schema/users';
export * from './schema/garments';
export * from './schema/rules';
export * from './schema/abbreviations';
export * from './schema/warehouse';

