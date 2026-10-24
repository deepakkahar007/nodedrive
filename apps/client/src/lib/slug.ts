const MAX_BASE_LENGTH = 32;

/** URL-safe base for an organization slug. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_BASE_LENGTH)
      .replace(/-+$/g, "") || "org"
  );
}

/** Short random suffix that keeps organization slugs unique. */
export function createSlugSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Reusable organization slug: readable name plus a uuid fragment. */
export function createOrganizationSlug(name: string): string {
  return `${slugify(name)}-${createSlugSuffix()}`;
}
