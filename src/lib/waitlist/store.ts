import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";

// Waitlist store — a single JSON "file" of entries, backed by whichever
// storage is actually persistent in the current environment:
//  - Locally (no BLOB_READ_WRITE_TOKEN): the filesystem, at ./data,
//    gitignored so real addresses never land in the repo.
//  - In production on Vercel: Vercel Blob. Vercel's serverless functions
//    have an ephemeral, effectively read-only filesystem — writes to
//    ./data would silently vanish on the next cold start or deploy — so
//    local-file storage only works for local dev.
// Same read-modify-write shape either way; callers don't know the difference.

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "waitlist.json");
const BLOB_PATHNAME = "waitlist/emails.json";
// Must match how the connected Blob store is actually configured (Vercel
// dashboard → Storage → store settings) — passing the wrong one throws.
const BLOB_ACCESS = "private";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

interface Entry {
  email: string;
  joinedAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Seeded starting count for the displayed "N already on the list" — captain's
// call, per-request. Real signups still add on top of this; drop it to 0
// whenever the real count should stand on its own.
const DISPLAY_COUNT_OFFSET = 101;

export class WaitlistError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function readAll(): Promise<Entry[]> {
  if (USE_BLOB) {
    // get() looks the blob up by pathname directly and handles the
    // Authorization header a private store requires — a raw fetch() to the
    // blob's URL would 401/403 for a private store with no way to attach
    // the token to a URL string built by hand.
    const result = await get(BLOB_PATHNAME, { access: BLOB_ACCESS, useCache: false });
    if (!result) return [];
    return (await new Response(result.stream).json()) as Entry[];
  }

  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Entry[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(entries: Entry[]) {
  if (USE_BLOB) {
    // Fixed pathname + no random suffix so this is always the same "file" —
    // the standard Vercel Blob pattern for a single mutable JSON document.
    await put(BLOB_PATHNAME, JSON.stringify(entries, null, 2), {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(entries, null, 2));
}

export async function addEmail(rawEmail: string): Promise<{ count: number; alreadyJoined: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new WaitlistError("Please enter a valid email");

  const entries = await readAll();
  const alreadyJoined = entries.some((e) => e.email === email);
  if (!alreadyJoined) {
    entries.push({ email, joinedAt: new Date().toISOString() });
    await writeAll(entries);
  }
  return { count: entries.length + DISPLAY_COUNT_OFFSET, alreadyJoined };
}

export async function getCount(): Promise<number> {
  return (await readAll()).length + DISPLAY_COUNT_OFFSET;
}
