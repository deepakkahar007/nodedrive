import {
  completeMultipartUpload,
  getObjectMetadata,
  getPresignedUploadUrl,
  type UploadedPart,
} from "@repo/storage";

export type StoredSession = {
  storage_key: string;
  mime_type: string;
  expected_size: number;
  expected_hash: string;
  part_size: number | null;
  multipart_upload_id: string | null;
};

const hexToBase64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");

export const partCount = (size: number, partSize: number) => Math.ceil(size / partSize);

/** Single PUT with the SHA-256 attached, so S3 rejects bodies that don't match. */
export function presignSingleUpload(session: StoredSession) {
  return getPresignedUploadUrl({
    key: session.storage_key,
    contentType: session.mime_type,
    checksumSha256: hexToBase64(session.expected_hash),
  });
}

/** Finishes the multipart upload and checks the stored size. Returns false on any mismatch. */
export async function finalizeStoredUpload(
  session: StoredSession,
  parts: UploadedPart[] | undefined,
): Promise<boolean> {
  try {
    if (session.multipart_upload_id && session.part_size) {
      const expected = partCount(session.expected_size, session.part_size);
      const ordered = [...(parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);

      if (ordered.length !== expected) return false;
      if (ordered.some((part, index) => part.partNumber !== index + 1)) return false;

      await completeMultipartUpload({
        key: session.storage_key,
        uploadId: session.multipart_upload_id,
        parts: ordered,
      });
    }

    const stored = await getObjectMetadata(session.storage_key);

    if (stored.size !== session.expected_size) return false;

    // ponytail: multipart skips the hash check, S3 has no full-object SHA-256 for it; add composite verify later
    if (!session.multipart_upload_id) {
      return stored.checksumSha256 === hexToBase64(session.expected_hash);
    }

    return true;
  } catch {
    return false;
  }
}
