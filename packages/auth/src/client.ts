"use client";

import { clientEnv } from "@repo/env/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [organizationClient()],
});

type UserInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string | null;
  expiresAt: string | Date;
};

type AuthError = {
  error: string | null;
};

type AuthResult<T> = {
  data: T | null;
  error: string | null;
};

type SignInEmailInput = {
  email: string;
  password: string;
  callbackURL?: string;
};

type SignUpEmailInput = SignInEmailInput & {
  name: string;
};

type SocialInput = {
  callbackURL?: string;
};

type InvitationInput = {
  invitationId: string;
};

type OrganizationIdInput = {
  organizationId: string;
};

type InviteMemberRole = Parameters<
  typeof authClient.organization.inviteMember
>[0]["role"];

type InviteMemberInput = OrganizationIdInput & {
  email: string;
  role?: InviteMemberRole;
};

type CreateOrganizationInput = {
  name: string;
  slug: string;
  logo?: string;
};

type CreatedOrganization = {
  id: string;
};

export function useSession() {
  return authClient.useSession();
}

export async function signInWithEmail(
  input: SignInEmailInput,
): Promise<AuthError> {
  const { error } = await authClient.signIn.email(input);
  return { error: error?.message ?? null };
}

export async function signUpWithEmail(
  input: SignUpEmailInput,
): Promise<AuthError> {
  const { error } = await authClient.signUp.email(input);
  return { error: error?.message ?? null };
}

export async function signInWithGoogle({
  callbackURL,
}: SocialInput): Promise<AuthError> {
  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL,
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<AuthError> {
  const { error } = await authClient.signOut();
  return { error: error?.message ?? null };
}

export async function listUserInvitations(): Promise<
  AuthResult<UserInvitation[]>
> {
  const { data, error } = await authClient.organization.listUserInvitations();
  return {
    data: (data ?? null) as UserInvitation[] | null,
    error: error?.message ?? null,
  };
}

export async function acceptInvitation({
  invitationId,
}: InvitationInput): Promise<AuthError> {
  const { error } = await authClient.organization.acceptInvitation({
    invitationId,
  });
  return { error: error?.message ?? null };
}

export async function rejectInvitation({
  invitationId,
}: InvitationInput): Promise<AuthError> {
  const { error } = await authClient.organization.rejectInvitation({
    invitationId,
  });
  return { error: error?.message ?? null };
}

export async function setActiveOrganization({
  organizationId,
}: OrganizationIdInput): Promise<AuthError> {
  const { error } = await authClient.organization.setActive({
    organizationId,
  });
  return { error: error?.message ?? null };
}

export async function inviteMember({
  organizationId,
  email,
  role = "member",
}: InviteMemberInput): Promise<AuthError> {
  const { error } = await authClient.organization.inviteMember({
    organizationId,
    email,
    role,
  });
  return { error: error?.message ?? null };
}

export async function createOrganization({
  name,
  slug,
  logo,
}: CreateOrganizationInput): Promise<AuthResult<CreatedOrganization>> {
  const { data, error } = await authClient.organization.create({
    name,
    slug,
    logo,
  });
  return {
    data: data as CreatedOrganization | null,
    error: error?.message ?? null,
  };
}
