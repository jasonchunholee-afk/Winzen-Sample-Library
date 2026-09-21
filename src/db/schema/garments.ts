import { integer, pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Garments Table
 * Core entity for apparel specifications, merchandising tags, fabric compositions, and review states.
 */
export const garments = pgTable('garments', {
  id: text('id').primaryKey(),
  brand: text('brand'),
  buyer: text('buyer'),
  season: text('season'),
  sales: text('sales'),
  merchandiser: text('merchandiser'),
  brand_code: text('brand_code'),
  goods_no: text('goods_no'),
  handwritten_notes: text('handwritten_notes'),
  cust_style_no: text('cust_style_no'),
  y_style_no: text('y_style_no'),
  garment_type: text('garment_type'),
  sample_stage: text('sample_stage'),
  washing: text('washing'),
  fabric_raw: text('fabric_raw'),
  gnw_weight: text('gnw_weight'),
  gnw_is_ai_estimated: integer('gnw_is_ai_estimated').default(0),
  fabric_yarn_count: text('fabric_yarn_count'),
  fabric_material: text('fabric_material'),
  fabric_construction: text('fabric_construction'),
  sample_job_no: text('sample_job_no'),
  color: text('color'),
  color_is_ai_estimated: integer('color_is_ai_estimated').default(0),
  size: text('size'),
  print_datetime: text('print_datetime'),
  description: text('description'),
  remark_memo: text('remark_memo'),
  location: text('location'),
  shelving_status: text('shelving_status').default('unshelfed'),
  assigned_location: text('assigned_location'),
  temp_container: text('temp_container').default('Temp Box 1'),
  shelved_at: timestamp('shelved_at'),
  shelved_by: text('shelved_by'),
  warehouse_batch_id: text('warehouse_batch_id'),
  status: text('status'),
  reviewer_feedback: text('reviewer_feedback'),
  structural_feedback: text('structural_feedback'),
  content_notes: text('content_notes'),
  hashtags: text('hashtags'),
  invisible_hashtags: text('invisible_hashtags'),
  default_front_image_id: integer('default_front_image_id'),
  previous_generated_code: text('previous_generated_code'),
  equated_by: text('equated_by'),
  equated_at: timestamp('equated_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => [
  index('garments_status_idx').on(table.status),
  index('garments_buyer_idx').on(table.buyer),
  index('garments_season_idx').on(table.season),
  index('garments_status_buyer_idx').on(table.status, table.buyer),
]);

/**
 * Images Table
 * Stores photography views (Front, Back, Label) and base64 payloads.
 */
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  role: text('role'),
  filename: text('filename'),
  thumb_base64: text('thumb_base64'),
  ai_base64: text('ai_base64'),
  raw_base64: text('raw_base64'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => [
  index('images_garment_id_idx').on(table.garment_id),
  index('images_role_idx').on(table.role),
]);

/**
 * Summaries Table
 * Persists AI-generated descriptions and user ratings.
 */
export const summaries = pgTable('summaries', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  summary_text: text('summary_text'),
  rating: integer('rating').default(0),
  created_at: timestamp('created_at').defaultNow(),
});

/**
 * Structural Change Requests Table
 * Tracks feedback-driven field updates and dependent changes.
 */
export const structural_change_requests = pgTable('structural_change_requests', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  raw_feedback: text('raw_feedback'),
  structural_requests: text('structural_requests'),
  dependent_updates: text('dependent_updates'),
  field_changes: text('field_changes'),
  applied_at: timestamp('applied_at'),
  status: text('status').default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export const structuralChangeRequestsRelations = relations(structural_change_requests, ({ one }) => ({
  garment: one(garments, {
    fields: [structural_change_requests.garment_id],
    references: [garments.id]
  })
}));
