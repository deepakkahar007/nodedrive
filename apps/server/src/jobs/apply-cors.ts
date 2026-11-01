import { serverEnv } from "@repo/env";
import { applyBucketCors } from "@repo/storage";

await applyBucketCors(serverEnv.CLIENT_URL);
console.log(`Bucket CORS applied for ${serverEnv.CLIENT_URL}`);
