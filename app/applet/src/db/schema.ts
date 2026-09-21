// src/db/schema.ts
import { integer, pgTable, serial, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const garments = pgTable('garments', {
  id: text('id').primaryKey(),
  brand: text('brand'),
  buyer: text('buyer'),
  season: text('season'),
  sales: text('sales'),
  cust_style_no: text('cust_style_no'),
  y_style_no: text('y_style_no'),
  garment_type: text('garment_type'),
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
  status: text('status'),
  reviewer_feedback: text('reviewer_feedback'),
  structural_feedback: text('structural_feedback'),
  content_notes: text('content_notes'),
  hashtags: text('hashtags'),
  default_front_image_id: integer('default_front_image_id'),
  created_at: timestamp('created_at').defaultNow(),
});

export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  role: text('role'),
  filename: text('filename'),
  created_at: timestamp('created_at').defaultNow(),
});

export const summaries = pgTable('summaries', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  summary_text: text('summary_text'),
  rating: integer('rating').default(0),
  created_at: timestamp('created_at').defaultNow(),
});

export const structural_change_requests = pgTable('structural_change_requests', {
  id: serial('id').primaryKey(),
  garment_id: text('garment_id').references(() => garments.id),
  raw_feedback: text('raw_feedback'),
  structural_requests: jsonb('structural_requests'),
  dependent_updates: jsonb('dependent_updates'),
  status: text('status').default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export const garmentsRelations = relations(garments, ({ many }) => ({
  images: many(images),
  summaries: many(summaries)
}));

export const imagesRelations = relations(images, ({ one }) => ({
  garment: one(garments, {
    fields: [images.garment_id],
    references: [garments.id]
  })
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  garment: one(garments, {
    fields: [summaries.garment_id],
    references: [garments.id]
  })
}));
