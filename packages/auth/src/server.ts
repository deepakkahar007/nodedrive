import { auth } from "./auth";

export type AuthSession = typeof auth.$Infer.Session;
export type Organization = Awaited<
  ReturnType<typeof auth.api.listOrganizations>
>[number];
export type FullOrganization = NonNullable<
  Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

type RequestInput = {
  headers: Headers;
};

type OrganizationInput = RequestInput & {
  organizationId: string;
};

type AuthRequestInput = {
  url: string;
  method: string;
  headers: Headers;
  body?: string;
};

export async function getSession({ headers }: RequestInput) {
  return auth.api.getSession({ headers });
}

export async function listOrganizations({ headers }: RequestInput) {
  return auth.api.listOrganizations({ headers });
}

export async function getFullOrganization({
  organizationId,
  headers,
}: OrganizationInput): Promise<FullOrganization | null> {
  try {
    return await auth.api.getFullOrganization({
      query: { organizationId },
      headers,
    });
  } catch {
    return null;
  }
}

export function handleAuthRequest({
  url,
  method,
  headers,
  body,
}: AuthRequestInput) {
  return auth.handler(new Request(url, { method, headers, body }));
}
