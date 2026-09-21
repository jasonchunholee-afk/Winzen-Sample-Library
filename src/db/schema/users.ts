import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Users Schema
 * Maps Firebase Auth user identities to internal database user records.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
