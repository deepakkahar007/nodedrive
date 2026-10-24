import { eq } from "drizzle-orm";
import { db } from "../index";
import { member, organization } from "../models";

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
