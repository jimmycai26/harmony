import { promises as fs } from "node:fs";
import path from "node:path";

// Local, file-backed waitlist store — good enough for "keep track of the
// emails" while this stays exploratory. /data is gitignored so real
// addresses never land in the repo. Swap for a real destination (a DB, a
// mail tool) whenever this needs to be more than a local list.

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "waitlist.json");

interface Entry {
  email: string;
  joinedAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class WaitlistError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Entry[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(entries: Entry[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(entries, null, 2));
}

export async function addEmail(rawEmail: string): Promise<{ count: number; alreadyJoined: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new WaitlistError("That doesn't look like a valid email.");

  const entries = await readAll();
  const alreadyJoined = entries.some((e) => e.email === email);
  if (!alreadyJoined) {
    entries.push({ email, joinedAt: new Date().toISOString() });
    await writeAll(entries);
  }
  return { count: entries.length, alreadyJoined };
}

export async function getCount(): Promise<number> {
  return (await readAll()).length;
}
