import { pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isDeleted, deletedAt } from "./modelsHelper";
import { organization, user } from "./AuthTable";

export const FolderTable = pgTable("folder", {
  id,

  user_id: text("user_id")
    .notNull()
    .references(() => user.id),
  organization_id: text("organization_id").references(() => organization.id),

  name: varchar("name").notNull(),
  shared_with: varchar("shared_with").array(),

  createdAt,
  updatedAt,
  isDeleted,
  deletedAt,
});
