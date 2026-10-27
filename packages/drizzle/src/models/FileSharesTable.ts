import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./modelsHelper";
import { FilesTable } from "./FilesTable";
import { user } from "./AuthTable";

export const FileSharesTable = pgTable(
  "file_shares",
  {
    id,

    file_id: uuid("file_id")
      .notNull()
      .references(() => FilesTable.id, { onDelete: "cascade" }),
    shared_with_user_id: text("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt,
  },
  (table) => [
    uniqueIndex("file_shares_file_user_uidx").on(
      table.file_id,
      table.shared_with_user_id,
    ),
    index("file_shares_shared_with_user_id_idx").on(table.shared_with_user_id),
  ],
);
