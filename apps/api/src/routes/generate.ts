import type { FastifyInstance } from 'fastify';
import { AXIS_LABELS } from '../axes';
import { generateBodySchema } from '../schemas';
import type { GenerationStore } from '../store';

export function registerGenerateRoutes(app: FastifyInstance, store: GenerationStore): void {
  app.post('/generate', async (request, reply) => {
    const parsed = generateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const generation = store.createGeneration(parsed.data);

    return reply.code(201).send({
      generationId: generation.id,
      status: generation.status,
      tracks: generation.tracks.map((t) => ({ id: t.id, letter: t.letter, status: t.status })),
      axes: generation.axes.map((key) => ({ key, label: AXIS_LABELS[key] })),
      eventsUrl: `/generate/${generation.id}/events`,
    });
  });

  app.get('/generate/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const generation = store.getGeneration(id);
    if (!generation) {
      return reply.code(404).send({ error: 'not_found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.hijack();

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    let unsubscribe: (() => void) | undefined;
    let heartbeat: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      reply.raw.end();
    };

    // Replay state that's already known, so a client that connects mid
    // generation (or reconnects) still sees every track that's already ready.
    for (const track of generation.tracks) {
      if (track.status === 'ready') {
        send('track-ready', {
          trackId: track.id,
          letter: track.letter,
          index: generation.tracks.indexOf(track),
        });
      }
    }

    if (generation.status !== 'generating') {
      const firstBattle = generation.battles[0];
      if (firstBattle) {
        send('all-ready', {
          generationId: generation.id,
          tracks: generation.tracks.map((t) => ({ id: t.id, letter: t.letter })),
          firstBattle: {
            id: firstBattle.id,
            round: firstBattle.round,
            left: {
              trackId: firstBattle.leftTrackId,
              letter: generation.tracks.find((t) => t.id === firstBattle.leftTrackId)!.letter,
            },
            right: {
              trackId: firstBattle.rightTrackId,
              letter: generation.tracks.find((t) => t.id === firstBattle.rightTrackId)!.letter,
            },
            axes: generation.axes.map((key) => ({ key, label: AXIS_LABELS[key] })),
          },
        });
      }
      cleanup();
      return;
    }

    unsubscribe = store.subscribeToGenerationEvents(id, (event) => {
      if (event.type === 'track-ready') {
        send('track-ready', { trackId: event.trackId, letter: event.letter, index: event.index });
      } else if (event.type === 'all-ready') {
        send('all-ready', {
          generationId: event.generationId,
          tracks: event.tracks,
          firstBattle: event.firstBattle,
        });
        cleanup();
      }
    });

    heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15000);
    request.raw.on('close', cleanup);
  });
}
