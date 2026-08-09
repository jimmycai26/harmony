import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadR2ConfigFromEnv, type R2Config } from "./config.js";
import { peaksKeyFor, type PeaksData } from "./peaks.js";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export interface UploadAudioOptions {
  /** Object key, e.g. "tracks/<generationId>/<modelSlot>.mp3". */
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

/**
 * Thin wrapper around the S3-compatible client for Cloudflare R2.
 *
 * R2 is API-compatible with S3, so this reuses @aws-sdk/client-s3 pointed at
 * R2's endpoint (https://<account_id>.r2.cloudflarestorage.com) instead of
 * AWS. R2 was chosen over S3 because Harmony's access pattern — every
 * comparison view streams multiple audio files, repeatedly — is a worst
 * case for egress-billed storage; R2 charges no egress fees.
 */
export class HarmonyStorageClient {
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor(config: R2Config = loadR2ConfigFromEnv()) {
    this.bucketName = config.bucketName;
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /** Uploads an audio file/buffer to the bucket under the given key. */
  async uploadAudio(options: UploadAudioOptions): Promise<{ key: string }> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
    };
    await this.s3.send(new PutObjectCommand(input));
    return { key: options.key };
  }

  /**
   * Generates a time-limited signed URL for playback/download of an object.
   * Defaults to a 1 hour TTL — long enough for a comparison session, short
   * enough that leaked URLs don't stay valid indefinitely.
   */
  async getSignedPlaybackUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  /** Deletes an object (e.g. an audio file or a peaks JSON file) by key. */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }

  /** Deletes an audio object and its sidecar peaks JSON together. */
  async deleteAudioWithPeaks(audioKey: string): Promise<void> {
    await Promise.all([this.deleteObject(audioKey), this.deleteObject(peaksKeyFor(audioKey))]);
  }

  /** Uploads a peaks JSON file alongside the given audio object key. */
  async uploadPeaks(audioKey: string, peaks: PeaksData): Promise<{ key: string }> {
    const key = peaksKeyFor(audioKey);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(peaks),
        ContentType: "application/json",
      }),
    );
    return { key };
  }

  /**
   * Fetches and parses the peaks JSON file for an audio object. Returns
   * null if no peaks file has been generated/uploaded yet for that key.
   */
  async getPeaks(audioKey: string): Promise<PeaksData | null> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: peaksKeyFor(audioKey) }),
      );
      const body = await response.Body?.transformToString();
      return body ? (JSON.parse(body) as PeaksData) : null;
    } catch (error) {
      if (isNoSuchKeyError(error)) {
        return null;
      }
      throw error;
    }
  }
}

function isNoSuchKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "NoSuchKey"
  );
}
