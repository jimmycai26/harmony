import type { FastifyInstance } from 'fastify';
import type { GenerationStore } from '../store';

export function registerLayersRoutes(app: FastifyInstance, store: GenerationStore): void {
  app.get('/layers/:trackId', async (request, reply) => {
    const { trackId } = request.params as { trackId: string };
    const layers = store.getLayers(trackId);
    if (!layers) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return reply.send(layers);
  });
}
