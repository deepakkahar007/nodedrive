import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "../index";
import { FilesTable, member, organization } from "../models";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  access: "owned" | "shared";
};

export async function listUserOrganizations(
  userId: string,
): Promise<UserOrganization[]> {
  const memberships = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(organization.name);

  return memberships.map(({ role, ...org }) => ({
    ...org,
    access: role
      .split(",")
      .map((entry) => entry.trim())
      .includes("owner")
      ? "owned"
      : "shared",
  }));
}

export type CreateFileInput = {
  userId: string;
  organizationId?: string | null;
  storageKey: string;
  name: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType: string;
};

/** Insert uploaded file records. */
export async function createFiles(inputs: CreateFileInput[]) {
  if (inputs.length === 0) return [];

  return db
    .insert(FilesTable)
    .values(
      inputs.map((input) => ({
        user_id: input.userId,
        organization_id: input.organizationId ?? null,
        storage_url: input.storageKey,
        name: input.name,
        originalName: input.originalName,
        extension: input.extension,
        size: String(input.size),
        mime_type: input.mimeType,
      })),
    )
    .returning();
}

export type FileSection =
  "home" | "my-drive" | "computers" | "shared" | "recent" | "starred" | "bin";

export type FileListItem = {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: string;
  updatedAt: Date;
  isStarred: boolean;
  organizationId: string | null;
};

const fileColumns = {
  id: FilesTable.id,
  name: FilesTable.name,
  originalName: FilesTable.originalName,
  extension: FilesTable.extension,
  mimeType: FilesTable.mime_type,
  size: FilesTable.size,
  updatedAt: FilesTable.updatedAt,
  isStarred: FilesTable.is_starred,
  organizationId: FilesTable.organization_id,
};

/** Files owned by the user plus files in organizations they belong to. */
function accessibleFiles(userId: string) {
  const organizationIds = db
    .select({ id: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return or(
    eq(FilesTable.user_id, userId),
    inArray(FilesTable.organization_id, organizationIds),
  );
}

type ListFilesInput = { userId: string; section: FileSection };

export async function listFiles({
  userId,
  section,
}: ListFilesInput): Promise<FileListItem[]> {
  if (section === "computers") return [];

  const conditions = [eq(FilesTable.isDeleted, section === "bin")];

  if (section === "my-drive") {
    conditions.push(eq(FilesTable.user_id, userId));
    conditions.push(isNull(FilesTable.organization_id));
  } else {
    const access = accessibleFiles(userId);

    if (access) conditions.push(access);
  }

  if (section === "shared") {
    conditions.push(isNotNull(FilesTable.organization_id));
  }

  if (section === "starred") {
    conditions.push(eq(FilesTable.is_starred, true));
  }

  return db
    .select(fileColumns)
    .from(FilesTable)
    .where(and(...conditions))
    .orderBy(desc(FilesTable.updatedAt))
    .limit(section === "home" ? 10 : 50);
}

type FileIdInput = { fileId: string; userId: string };

/** File details for download, scoped to files the user can access. */
export async function getFileForUser({ fileId, userId }: FileIdInput) {
  const access = accessibleFiles(userId);

  if (!access) return null;

  const [file] = await db
    .select({ ...fileColumns, storageKey: FilesTable.storage_url })
    .from(FilesTable)
    .where(and(eq(FilesTable.id, fileId), access))
    .limit(1);

  return file ?? null;
}

type UpdateFileInput = {
  fileId: string;
  userId: string;
  starred?: boolean;
  trashed?: boolean;
};

export async function updateFileForUser({
  fileId,
  userId,
  starred,
  trashed,
}: UpdateFileInput) {
  const access = accessibleFiles(userId);

  if (!access) return null;

  const [file] = await db
    .update(FilesTable)
    .set({
      ...(starred !== undefined ? { is_starred: starred } : {}),
      ...(trashed !== undefined
        ? {
            isDeleted: trashed,
            deletedAt: trashed ? new Date() : null,
          }
        : {}),
    })
    .where(and(eq(FilesTable.id, fileId), access))
    .returning(fileColumns);

  return file ?? null;
}
