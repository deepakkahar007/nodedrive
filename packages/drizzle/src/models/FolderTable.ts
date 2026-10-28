import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isDeleted, deletedAt } from "./modelsHelper";
import { organization, user } from "./AuthTable";

export const FolderTable = pgTable(
  "folder",
  {
    id,

    user_id: text("user_id")
      .notNull()
      .references(() => user.id),
    organization_id: text("organization_id").references(() => organization.id),

    name: varchar("name").notNull(),
    parent_id: uuid("parent_id").references(
      (): AnyPgColumn => FolderTable.id,
      { onDelete: "cascade" },
    ),
    shared_with: varchar("shared_with").array(),

    createdAt,
    updatedAt,
    isDeleted,
    deletedAt,
  },
  (table) => [
    index("folder_user_id_idx").on(table.user_id),
    index("folder_parent_id_idx").on(table.parent_id),
  ],
);
