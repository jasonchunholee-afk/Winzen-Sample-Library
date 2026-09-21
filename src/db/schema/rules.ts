import { pgTable, serial, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

/**
 * Labeling Rules Table
 * Persists calibrated OCR, taxonomy, and parsing rules derived from expert commentary and test suites.
 */
export const labeling_rules = pgTable('labeling_rules', {
  id: serial('id').primaryKey(),
  rule_code: text('rule_code').notNull().unique(),
  rule_type: text('rule_type').notNull(), // 'positive' | 'negative'
  target_field: text('target_field').notNull(),
  rule_title: text('rule_title').notNull(),
  condition_trigger: text('condition_trigger').notNull(),
  rule_instruction: text('rule_instruction').notNull(),
  example_positive: text('example_positive'),
  example_negative: text('example_negative'),
  source_feedback: text('source_feedback'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('labeling_rules_target_field_idx').on(table.target_field),
  index('labeling_rules_is_active_idx').on(table.is_active),
]);

export const equated_codes = pgTable('equated_codes', {
  id: text('id').primaryKey(),
  source_code: text('source_code').notNull(),
  target_code: text('target_code').notNull(),
  category: text('category').default('size'),
  created_at: timestamp('created_at').defaultNow(),
});

export const fgd_reports = pgTable('fgd_reports', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  report_data: text('report_data').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const fgd_observations = pgTable('fgd_observations', {
  id: text('id').primaryKey(),
  item_code: text('item_code').notNull(),
  observation_text: text('observation_text').notNull(),
  submitted_by: text('submitted_by').notNull().default('Jennifer'),
  timestamp: timestamp('timestamp').defaultNow(),
});

