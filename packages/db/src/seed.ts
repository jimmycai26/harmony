import "dotenv/config";
import { createDb } from "./client";
import { models, type NewModel } from "./schema";

// Placeholder 4-model roster (PRD.md "Prior decisions this PRD assumes" +
// technical considerations: 6 ToS-clean models were identified, v1 ships a
// subset of 4). These four and their provider labels are NOT final — the
// roster is explicitly called out as "actively refined" pending ToS and
// licensing research. Update this list (and re-run the seed) as that
// research lands; don't treat these rows as a real decision.
const PLACEHOLDER_MODELS: NewModel[] = [
  { slug: "stable-audio", displayName: "Stable Audio", provider: "Stability AI" },
  { slug: "lyria-2", displayName: "Lyria 2", provider: "Google DeepMind" },
  { slug: "elevenlabs-music", displayName: "ElevenLabs", provider: "ElevenLabs" },
  { slug: "minimax-music", displayName: "MiniMax", provider: "MiniMax" },
];

async function main() {
  const db = createDb();
  await db.insert(models).values(PLACEHOLDER_MODELS).onConflictDoNothing({ target: models.slug });
  console.log(`Seeded ${PLACEHOLDER_MODELS.length} placeholder models (or already present).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
