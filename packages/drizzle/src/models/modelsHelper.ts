import { uuid, timestamp, boolean } from "drizzle-orm/pg-core";

export const id = uuid("id").primaryKey().defaultRandom();
export const isActive = boolean("is_active").notNull().default(true);

export const createdAt = timestamp("created_at").notNull().defaultNow();
export const updatedAt = timestamp("updated_at").notNull().defaultNow();

export const deletedAt = timestamp("deleted_at");
export const isDeleted = boolean("is_deleted").notNull().default(false);
