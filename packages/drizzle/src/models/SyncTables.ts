import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { ChangeOp, ChangePayload, NodeKind } from "@repo/sync-protocol";
import { id, createdAt } from "./modelsHelper";
import { FilesTable } from "./FilesTable";
import { user } from "./AuthTable";

export const accountSyncState = pgTable("account_sync_state", {
  account_id: text("account_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  last_seq: bigint("last_seq", { mode: "number" }).notNull().default(0),
  min_valid_seq: bigint("min_valid_seq", { mode: "number" }).notNull().default(0),
});

export const changes = pgTable(
  "changes",
  {
    account_id: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    node_id: uuid("node_id").notNull(),
    node_kind: varchar("node_kind").$type<NodeKind>().notNull(),
    op: varchar("op").$type<ChangeOp>().notNull(),
    revision: integer("revision").notNull(),
    payload: jsonb("payload").$type<ChangePayload | null>(),
    created_at: createdAt,
  },
  (table) => [primaryKey({ columns: [table.account_id, table.seq] })],
);

export const devices = pgTable("devices", {
  id,
  user_id: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  label: varchar("label").notNull(),
  user_agent: varchar("user_agent"),
  last_seen_at: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt,
});

export const syncLogs = pgTable(
  "sync_logs",
  {
    id,
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    device_id: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    run_id: varchar("run_id").notNull(),
    trigger: varchar("trigger").notNull(),
    started_at: timestamp("started_at").notNull(),
    finished_at: timestamp("finished_at").notNull(),
    counts: jsonb("counts").notNull(),
    bytes_up: bigint("bytes_up", { mode: "number" }).notNull(),
    bytes_down: bigint("bytes_down", { mode: "number" }).notNull(),
    status: varchar("status").notNull(),
    error_summary: text("error_summary"),
    createdAt,
  },
  (table) => [
    uniqueIndex("sync_logs_user_run_uidx").on(table.user_id, table.run_id),
    index("sync_logs_user_created_idx").on(table.user_id, table.createdAt),
  ],
);

export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id,
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    device_id: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    file_id: uuid("file_id").references(() => FilesTable.id, { onDelete: "set null" }),
    parent_id: uuid("parent_id"),
    name: varchar("name").notNull(),
    mime_type: varchar("mime_type").notNull(),
    base_revision: integer("base_revision"),
    expected_size: bigint("expected_size", { mode: "number" }).notNull(),
    expected_hash: varchar("expected_hash").notNull(),
    mtime: timestamp("mtime"),
    storage_key: text("storage_key").notNull(),
    part_size: integer("part_size"),
    multipart_upload_id: text("multipart_upload_id"),
    status: varchar("status").$type<"open" | "committed" | "aborted" | "expired">().notNull().default("open"),
    idempotency_key: varchar("idempotency_key").notNull(),
    result_file_id: uuid("result_file_id"),
    result_revision: integer("result_revision"),
    result_seq: bigint("result_seq", { mode: "number" }),
    expires_at: timestamp("expires_at").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("upload_sessions_user_key_uidx").on(table.user_id, table.idempotency_key),
  ],
);

export const fileRevisions = pgTable(
  "file_revisions",
  {
    id,
    file_id: uuid("file_id")
      .notNull()
      .references(() => FilesTable.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    storage_key: text("storage_key").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    content_hash: varchar("content_hash"),
    createdAt,
  },
  (table) => [uniqueIndex("file_revisions_file_rev_uidx").on(table.file_id, table.revision)],
);
