import { S3Client } from "@aws-sdk/client-s3";
import { serverEnv } from "@repo/env";

const endpoint = serverEnv.S3_ENDPOINT;

export const s3Client = new S3Client({
  region: serverEnv.AWS_REGION,
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials:
    serverEnv.AWS_ACCESS_KEY_ID && serverEnv.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: serverEnv.AWS_ACCESS_KEY_ID,
          secretAccessKey: serverEnv.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const bucketName = serverEnv.S3_BUCKET;
