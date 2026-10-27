import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../index";
import {
  FileSharesTable,
  FilesTable,
  member,
  organization,
  user,
} from "../models";

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
  organizationName: string | null;
  isSharedWithMe: boolean;
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

/** Files shared directly with the user. */
function sharedFileIds(userId: string) {
  return db
    .select({ id: FileSharesTable.file_id })
    .from(FileSharesTable)
    .where(eq(FileSharesTable.shared_with_user_id, userId));
}

/** Files the user can read: owned, organization, or shared directly with them. */
function viewableFiles(userId: string) {
  return or(
    accessibleFiles(userId),
    inArray(FilesTable.id, sharedFileIds(userId)),
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
    const access =
      section === "bin" || section === "starred"
        ? accessibleFiles(userId)
        : viewableFiles(userId);

    if (access) conditions.push(access);
  }

  if (section === "shared") {
    const shared = or(
      isNotNull(FilesTable.organization_id),
      inArray(FilesTable.id, sharedFileIds(userId)),
    );

    if (shared) conditions.push(shared);
  }

  if (section === "starred") {
    conditions.push(eq(FilesTable.is_starred, true));
  }

  const files = await db
    .select({ ...fileColumns, organizationName: organization.name })
    .from(FilesTable)
    .leftJoin(organization, eq(FilesTable.organization_id, organization.id))
    .where(and(...conditions))
    .orderBy(desc(FilesTable.updatedAt))
    .limit(section === "home" ? 10 : 50);

  const sharedIds = new Set(
    (await sharedFileIds(userId)).map((file) => file.id),
  );

  return files.map((file) => ({
    ...file,
    isSharedWithMe: sharedIds.has(file.id),
  }));
}

type OrganizationFilesInput = { organizationId: string; userId: string };

/** Files belonging to one organization, scoped to its members. */
export async function listOrganizationFiles({
  organizationId,
  userId,
}: OrganizationFilesInput): Promise<FileListItem[]> {
  const access = accessibleFiles(userId);

  if (!access) return [];

  const files = await db
    .select({ ...fileColumns, organizationName: organization.name })
    .from(FilesTable)
    .leftJoin(organization, eq(FilesTable.organization_id, organization.id))
    .where(
      and(
        eq(FilesTable.organization_id, organizationId),
        eq(FilesTable.isDeleted, false),
        access,
      ),
    )
    .orderBy(desc(FilesTable.updatedAt))
    .limit(100);

  return files.map((file) => ({ ...file, isSharedWithMe: false }));
}

type FileIdInput = { fileId: string; userId: string };

/** File details for download, scoped to files the user can access. */
export async function getFileForUser({ fileId, userId }: FileIdInput) {
  const access = viewableFiles(userId);

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

type ShareFileInput = { fileId: string; userId: string; email: string };

export type ShareFileResult =
  | { sharedWith: { id: string; name: string; email: string } }
  | {
      error: "file-not-found" | "user-not-found" | "self" | "already-shared";
    };

/** Share an accessible file with another user by email. */
export async function shareFileWithEmail({
  fileId,
  userId,
  email,
}: ShareFileInput): Promise<ShareFileResult> {
  const [file] = await db
    .select({ id: FilesTable.id })
    .from(FilesTable)
    .where(
      and(
        eq(FilesTable.id, fileId),
        eq(FilesTable.user_id, userId),
        eq(FilesTable.isDeleted, false),
      ),
    )
    .limit(1);

  if (!file) return { error: "file-not-found" };

  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(sql`lower(${user.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);

  if (!target) return { error: "user-not-found" };
  if (target.id === userId) return { error: "self" };

  const inserted = await db
    .insert(FileSharesTable)
    .values({ file_id: fileId, shared_with_user_id: target.id })
    .onConflictDoNothing()
    .returning({ id: FileSharesTable.id });

  if (inserted.length === 0) return { error: "already-shared" };

  return { sharedWith: target };
}
