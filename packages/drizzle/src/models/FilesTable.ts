import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isDeleted, deletedAt } from "./modelsHelper";
import { FolderTable } from "./FolderTable";
import { organization, user } from "./AuthTable";

export const FilesTable = pgTable("files", {
  id,

  name: varchar("name").notNull(),
  originalName: varchar("original_name").notNull(),
  extension: varchar("extension").notNull(),
  storage_url: varchar("storage_url").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  mime_type: varchar("mime_type").notNull(),
  is_starred: boolean("is_starred").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  content_hash: varchar("content_hash"),
  mtime: timestamp("mtime"),

  user_id: text("user_id")
    .notNull()
    .references(() => user.id),
  folder_id: uuid("folder_id").references(() => FolderTable.id),
  organization_id: text("organization_id").references(() => organization.id),

  createdAt,
  updatedAt,
  isDeleted,
  deletedAt,
});
