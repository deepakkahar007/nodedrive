import { pgTable, varchar } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./modelsHelper";

export const FilesTable = pgTable("files", {
  id,
  name: varchar("name", { length: 255 }).notNull(),
  createdAt,
  updatedAt,
});
