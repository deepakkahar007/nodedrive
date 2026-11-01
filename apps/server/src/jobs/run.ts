import { db } from "@repo/drizzle";
import { runMaintenance } from "./maintenance";

try {
  await runMaintenance();
} finally {
  await db.$client.end();
}
