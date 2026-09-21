import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Abbreviation Library Table
 * Maps textile, brand, and factory abbreviations to English and Traditional Chinese expansions.
 */
export const abbreviation_library = pgTable('abbreviation_library', {
  id: serial('id').primaryKey(),
  term: text('term').notNull().unique(),
  category: text('category').notNull(), // 'buyer/brand' | 'fiber/material' | 'garment/style' | 'factory/code' | 'unit'
  expansion_en: text('expansion_en').notNull(),
  expansion_zh: text('expansion_zh'),
  functional_notes: text('functional_notes'),
  source: text('source'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
