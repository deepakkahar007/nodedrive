import { randomUUID } from "node:crypto";
import { db } from "../index";
import { user } from "../models";

/** Test helper: inserts a user and returns its id. */
export async function createTestUser(): Promise<string> {
  const id = randomUUID();

  await db.insert(user).values({ id, name: "Test", email: `${id}@test.local` });

  return id;
}
