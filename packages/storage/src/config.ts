export interface R2Config {
  /** Cloudflare account ID — used to build the R2 S3-compatible endpoint. */
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Bucket that stores audio objects and their sidecar peaks JSON. */
  bucketName: string;
}

const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

/**
 * Reads R2 credentials from process.env (see .env.example for the expected
 * keys). Throws if any are missing, so misconfiguration fails at startup
 * rather than on the first upload.
 */
export function loadR2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 env vars: ${missing.join(", ")}. See packages/storage/.env.example.`,
    );
  }

  return {
    accountId: env.R2_ACCOUNT_ID as string,
    accessKeyId: env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    bucketName: env.R2_BUCKET_NAME as string,
  };
}
