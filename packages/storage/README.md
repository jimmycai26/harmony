# @harmony/storage

Cloudflare R2 client wrapper for storing and serving Harmony's generated audio
tracks (and their waveform peak data), used by the generation/orchestration
pipeline and the API layer that serves playback URLs to the frontend.

## Why R2, not S3

Every comparison view in Harmony streams multiple audio files, repeatedly —
that's a worst case for egress-billed storage. R2 has no egress fees; S3
does. An earlier technical research pass cited a real-world scenario where
that difference alone was >25x the cost at moderate scale. R2 is
S3-API-compatible, so this package just points `@aws-sdk/client-s3` at R2's
endpoint instead of AWS — no bespoke SDK needed.

## Install

This package is self-contained and not yet wired into a workspace (that
happens in a separate integration pass). Until then, install its
dependencies directly from this directory:

```sh
cd packages/storage
npm install   # or pnpm install / yarn install
npm run build
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values once a Cloudflare
account + R2 bucket exist. All four are required:

| Variable                | Description                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`          | Cloudflare account ID. Used to build the endpoint `https://<id>.r2.cloudflarestorage.com`. |
| `R2_ACCESS_KEY_ID`       | R2 API token access key (Cloudflare dashboard → R2 → Manage API Tokens).    |
| `R2_SECRET_ACCESS_KEY`   | R2 API token secret.                                                        |
| `R2_BUCKET_NAME`         | Name of the bucket that stores audio + peaks objects.                       |

`loadR2ConfigFromEnv()` reads these from `process.env` and throws immediately
if any are missing, so misconfiguration fails at startup rather than on the
first upload.

## Pointing this at a real R2 bucket

1. Create an R2 bucket in the Cloudflare dashboard (or via `wrangler r2 bucket create`).
2. Create an API token scoped to "Object Read & Write" on that bucket only
   (Cloudflare dashboard → R2 → Manage API Tokens → Create API Token).
3. Fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
   `R2_BUCKET_NAME` in your `.env` (or however this repo's env is wired up
   once the integration pass lands).
4. If public (non-signed) playback URLs are ever desired instead of the
   signed-URL approach below, R2 also supports a public bucket dev URL or a
   custom domain — not used here, since signed URLs give per-request
   expiry control, which matters for a blind-comparison product where you
   don't want track URLs floating around indefinitely.

## API

```ts
import { HarmonyStorageClient, loadR2ConfigFromEnv } from "@harmony/storage";

const storage = new HarmonyStorageClient(loadR2ConfigFromEnv());
```

The constructor also accepts an explicit `R2Config` object if you'd rather
not read from `process.env` (e.g. in tests).

- **`uploadAudio({ key, body, contentType })`** — uploads an audio
  file/buffer to the bucket under `key`.
- **`getSignedPlaybackUrl(key, expiresInSeconds?)`** — generates a
  time-limited signed URL for temporary playback/download access. Defaults
  to a 1 hour TTL.
- **`deleteObject(key)`** — deletes a single object by key.
- **`deleteAudioWithPeaks(audioKey)`** — deletes an audio object and its
  sidecar peaks JSON together.
- **`uploadPeaks(audioKey, peaks)`** — uploads a small peaks JSON file
  alongside an audio object (see below).
- **`getPeaks(audioKey)`** — fetches and parses that peaks JSON file.
  Returns `null` if none has been uploaded yet for that key.

Also exported: `peaksKeyFor(audioKey)` (the naming convention below) and
`generatePeaks(audioBuffer)` (currently a stub — see below).

## Waveform peaks data

`wavesurfer.js` on the frontend needs peak/waveform data to render each
track's waveform. Decoding N full audio files client-side, simultaneously
(one per model in a comparison), is wasteful and slow. Instead, this package
stores a small pre-decoded peaks JSON file alongside each audio object:

- Naming convention: `peaksKeyFor("tracks/abc123.mp3")` →
  `"tracks/abc123.mp3.peaks.json"` — same prefix as the audio object, so the
  two are easy to locate together and `deleteAudioWithPeaks` can clean up
  both.
- Shape (`PeaksData`): `{ version, duration, channels, peaks }`, where
  `peaks` is one `number[]` of interleaved min/max pairs per channel — the
  shape wavesurfer.js's peaks option expects, so the frontend can pass it in
  directly without a full decode.

### `generatePeaks()` is a stub

The actual peak-extraction/decoding logic is **not implemented yet** — it
depends on where in the generation pipeline the raw decoded audio buffer
becomes available, which is the orchestration package's concern, not
storage's. Two options were evaluated for whoever wires this up next:

- **`audiowaveform`** (BBC, native binary) — fast and battle-tested, and it
  already outputs JSON in roughly this shape, but it's a compiled binary
  invoked via `child_process`, not an npm dependency, which complicates
  deployment on serverless targets.
- **`audio-decode` + manual min/max binning** (pure JS/npm) — the more
  portable option, and the one to reach for first: decode with
  `audio-decode`, then downsample to ~800 points per channel by taking
  min/max over fixed-size buckets.

Calling `generatePeaks()` today throws with a message pointing back to this
TODO.
