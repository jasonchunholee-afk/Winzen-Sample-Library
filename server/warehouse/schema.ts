import { integer, pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Isolated Warehouse Locations Table Schema
 * Physical storage topology: Cabinet -> Shelf -> Stack (e.g. A3-1-1 to A3-10-3)
 */
export const warehouse_locations = pgTable('warehouse_locations', {
  id: serial('id').primaryKey(),
  cabinet_no: text('cabinet_no').notNull().default('A3'),
  shelf_no: integer('shelf_no').notNull().default(1),
  stack_no: integer('stack_no').notNull().default(1),
  location_code: text('location_code').notNull().unique(), // e.g. "A3-1-1"
  location_name: text('location_name'), // e.g. "Cabinet A3 • Shelf 1 • Stack 1"
  assigned_buyer: text('assigned_buyer'), // e.g. "HUGO", "BOSS", "Hugo Boss", "Unassigned"
  assigned_year: text('assigned_year'), // e.g. "2024", "2025", "All"
  assigned_type: text('assigned_type'), // e.g. "Polo", "Jacket", "All"
  max_capacity_units: integer('max_capacity_units').default(12),
  current_count: integer('current_count').default(0),
  pending_assigned_count: integer('pending_assigned_count').default(0),
  is_full: integer('is_full').default(0), // 0 = available, 1 = full
  fullness_level: text('fullness_level').default('AVAILABLE'), // 'EMPTY', 'AVAILABLE', 'NEAR_FULL', 'FULL', 'OVERFLOW'
  full_evidence_notes: text('full_evidence_notes'),
  last_inspected_at: timestamp('last_inspected_at'),
  last_photo_url: text('last_photo_url'),
  is_active: integer('is_active').default(1),
  stack_width_cm: integer('stack_width_cm').default(26),
  stack_depth_cm: integer('stack_depth_cm').default(40),
  is_partitioned: integer('is_partitioned').default(0),
  is_closed: integer('is_closed').default(0),
  assignment_mode: text('assignment_mode').default('Manual'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('warehouse_locations_code_idx').on(table.location_code),
  index('warehouse_locations_cabinet_idx').on(table.cabinet_no),
  index('warehouse_locations_buyer_idx').on(table.assigned_buyer),
]);

/**
 * Isolated Warehouse Batch Logs Table Schema
 * Chen's ~20 garment batch transfers from temporary bin to rolling cabinet
 */
export const warehouse_batches = pgTable('warehouse_batches', {
  id: serial('id').primaryKey(),
  batch_no: text('batch_no').notNull().unique(), // e.g. "BATCH-20260916-01"
  operator: text('operator').default('Chen'),
  garment_count: integer('garment_count').default(0),
  garment_ids: text('garment_ids'), // JSON array of garment IDs
  status: text('status').default('shelved'), // 'pending', 'shelving', 'shelved'
  photo_evidence_url: text('photo_evidence_url'),
  temp_container: text('temp_container').default('Temp Box 1'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  completed_at: timestamp('completed_at'),
});

/**
 * Merchandiser Rules Digestion logs for physical layout placement
 */
export const warehouse_logic_logs = pgTable('warehouse_logic_logs', {
  id: text('id').primaryKey(),
  garment_id: text('garment_id').notNull(),
  location_code: text('location_code').notNull(),
  logic_text: text('logic_text').notNull(),
  assigned_by: text('assigned_by').notNull().default('Jennifer'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const global_warehouse_logic = pgTable('global_warehouse_logic', {
  id: text('id').primaryKey(),
  logic_text: text('logic_text').notNull(),
  updated_by: text('updated_by').notNull().default('Jennifer'),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type WarehouseLocation = InferSelectModel<typeof warehouse_locations>;
export type NewWarehouseLocation = InferInsertModel<typeof warehouse_locations>;
export type WarehouseBatch = InferSelectModel<typeof warehouse_batches>;
export type NewWarehouseBatch = InferInsertModel<typeof warehouse_batches>;
