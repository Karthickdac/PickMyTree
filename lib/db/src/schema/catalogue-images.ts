import { pgTable, uuid, text, integer, boolean, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { platformUsers } from "./identity";

// Public catalogue photos only; never private identity, ownership or field evidence.
export const catalogueImages = pgTable("pat_catalogue_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => platformUsers.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  objectPath: text("object_path"),
  fixtureKey: text("fixture_key"),
  isIllustrative: boolean("is_illustrative").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index("pat_catalogue_image_owner_idx").on(t.ownerId),
  check("pat_catalogue_image_size", sql`${t.byteSize} > 0 AND ${t.byteSize} <= 10485760`),
  check("pat_catalogue_image_status", sql`${t.status} IN ('pending', 'ready', 'rejected')`),
]);
