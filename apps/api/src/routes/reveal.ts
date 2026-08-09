import type { FastifyInstance } from 'fastify';
import type { GenerationStore } from '../store';

export function registerRevealRoutes(app: FastifyInstance, store: GenerationStore): void {
  app.get('/reveal/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = store.getReveal(id);

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.code(409).send({ error: 'ladder_incomplete' });
    }

    return reply.send({
      generationId: result.generationId,
      winningTrack: result.winningTrack,
      model: result.model,
    });
  });
}
