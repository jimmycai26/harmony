/**
 * Local-only entry point for exercising this package against a real
 * Inngest Dev Server (`npx inngest-cli dev`) before it's wired into
 * `apps/api`. Not used in production — the API layer will import
 * `generateBatch` and its own `packages/models`-backed track function and
 * mount them on its own server via `serve()`/`createServer()` from
 * `inngest/node` (or whichever framework adapter it uses).
 *
 * Usage: `npm run dev`, then in another terminal `npx inngest-cli dev` and
 * send a `harmony/generate-batch.requested` event from its UI to watch the
 * fan-out run end to end against the mock model jobs.
 */
import { createServer } from "inngest/node";
import { inngest } from "./inngest/client.js";
import { generateBatch } from "./inngest/functions/generate-batch.js";
import { generateTrackWithMock } from "./inngest/functions/generate-track.js";

const PORT = Number(process.env.PORT ?? 3100);

const server = createServer({
  client: inngest,
  functions: [generateBatch, generateTrackWithMock],
});

server.listen(PORT, () => {
  console.log(`[orchestration] dev server listening on http://localhost:${PORT}/api/inngest`);
});
