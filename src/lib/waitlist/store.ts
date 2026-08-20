import { promises as fs } from "node:fs";
import path from "node:path";
import { list, put } from "@vercel/blob";

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
    // head() needs a blob's full URL, which a fresh serverless invocation
    // has no way to know in advance — list() is the correct way to look a
    // blob up by its pathname.
    const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
    const match = blobs.find((b) => b.pathname === BLOB_PATHNAME);
    if (!match) return [];
    const res = await fetch(match.url, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Entry[];
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
    // Note: Blob access is public-by-design (no private/auth mode) — the
    // URL carries a per-store random hostname, not guessable, but anyone
    // who obtains it can read it. Fine for a pre-launch waitlist; revisit
    // if this list needs to stay strictly confidential later.
    await put(BLOB_PATHNAME, JSON.stringify(entries, null, 2), {
      access: "public",
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
