import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload, type BodyDataTypes } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketName, s3Client } from "./client";

export { bucketName, s3Client } from "./client";
export { createStorageKey, type StorageKeyInput } from "./key";

const DEFAULT_EXPIRES_IN = 900;
const MIN_EXPIRES_IN = 1;
const MAX_EXPIRES_IN = 604_800; // S3 hard limit: 7 days

export type UploadFileInput = {
  key: string;
  body: NonNullable<BodyDataTypes>;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type UploadFileResult = {
  bucket: string;
  key: string;
  etag?: string;
};

export type PresignedUrlResult = {
  url: string;
  method: "GET" | "PUT";
  key: string;
  expiresIn: number;
  headers?: Record<string, string>;
};

export type PresignedUploadInput = {
  key: string;
  contentType?: string;
  expiresIn?: number;
};

export type PresignedDownloadInput = {
  key: string;
  expiresIn?: number;
  fileName?: string;
};

export type ObjectMetadata = {
  size: number;
  contentType?: string;
  etag?: string;
};

/** Stored object details. Throws if the object does not exist. */
export async function getObjectMetadata(key: string): Promise<ObjectMetadata> {
  const result = await s3Client.send(
    new HeadObjectCommand({ Bucket: bucketName, Key: key }),
  );

  return {
    size: result.ContentLength ?? 0,
    contentType: result.ContentType,
    etag: result.ETag,
  };
}

/** Removes a stored object. Missing keys are a no-op on S3. */
export async function deleteStoredObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
  );
}

/** Startup check: throws if S3/MinIO is unreachable or the bucket is missing. */
export async function checkStorageConnection(): Promise<void> {
  await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
}

function resolveExpiry(expiresIn?: number): number {
  const seconds = expiresIn ?? DEFAULT_EXPIRES_IN;

  if (
    !Number.isInteger(seconds) ||
    seconds < MIN_EXPIRES_IN ||
    seconds > MAX_EXPIRES_IN
  ) {
    throw new RangeError(
      `expiresIn must be an integer between ${MIN_EXPIRES_IN} and ${MAX_EXPIRES_IN} seconds`,
    );
  }

  return seconds;
}

/** Server-side upload. Uses multipart automatically for large bodies. */
export async function uploadFile(
  input: UploadFileInput,
): Promise<UploadFileResult> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
      Metadata: input.metadata,
    },
  });

  const result = await upload.done();

  return {
    bucket: result.Bucket ?? bucketName,
    key: result.Key ?? input.key,
    etag: result.ETag,
  };
}

/** Short-lived URL for direct browser upload. Send the returned headers too. */
export async function getPresignedUploadUrl(
  input: PresignedUploadInput,
): Promise<PresignedUrlResult> {
  const expiresIn = resolveExpiry(input.expiresIn);
  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn },
  );

  return {
    url,
    method: "PUT",
    key: input.key,
    expiresIn,
    headers: input.contentType
      ? { "Content-Type": input.contentType }
      : undefined,
  };
}

/** Short-lived URL for direct browser/API download. */
export async function getPresignedDownloadUrl(
  input: PresignedDownloadInput,
): Promise<PresignedUrlResult> {
  const expiresIn = resolveExpiry(input.expiresIn);
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: input.key,
      ResponseContentDisposition: input.fileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(input.fileName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`
        : undefined,
    }),
    { expiresIn },
  );

  return { url, method: "GET", key: input.key, expiresIn };
}
