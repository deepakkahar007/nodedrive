import { defineRelations } from "drizzle-orm/relations";
import * as schema from "./index";

export const relations = defineRelations(schema, (r) => ({
  FilesTable: {
    user: r.one.user({
      from: r.FilesTable.user_id,
      to: r.user.id,
    }),
    folder: r.one.FolderTable({
      from: r.FilesTable.folder_id,
      to: r.FolderTable.id,
    }),
    organization: r.one.organization({
      from: r.FilesTable.organization_id,
      to: r.organization.id,
    }),
    shares: r.many.FileSharesTable({
      from: r.FilesTable.id,
      to: r.FileSharesTable.file_id,
    }),
  },
  FileSharesTable: {
    file: r.one.FilesTable({
      from: r.FileSharesTable.file_id,
      to: r.FilesTable.id,
    }),
    user: r.one.user({
      from: r.FileSharesTable.shared_with_user_id,
      to: r.user.id,
    }),
  },
  FolderTable: {
    user: r.one.user({
      from: r.FolderTable.user_id,
      to: r.user.id,
    }),
    organization: r.one.organization({
      from: r.FolderTable.organization_id,
      to: r.organization.id,
    }),
  },
  user: {
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    members: r.many.member({
      from: r.user.id,
      to: r.member.userId,
    }),
    invitations: r.many.invitation({
      from: r.user.id,
      to: r.invitation.inviterId,
    }),
    files: r.many.FilesTable({
      from: r.user.id,
      to: r.FilesTable.user_id,
    }),
    sharedFiles: r.many.FileSharesTable({
      from: r.user.id,
      to: r.FileSharesTable.shared_with_user_id,
    }),
    folders: r.many.FolderTable({
      from: r.user.id,
      to: r.FolderTable.user_id,
    }),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  organization: {
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
    files: r.many.FilesTable({
      from: r.organization.id,
      to: r.FilesTable.organization_id,
    }),
    folders: r.many.FolderTable({
      from: r.organization.id,
      to: r.FolderTable.organization_id,
    }),
  },
  member: {
    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.member.userId,
      to: r.user.id,
    }),
  },
  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
  },
}));
