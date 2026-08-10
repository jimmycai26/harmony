import type { FastifyInstance } from 'fastify';
import { voteBodySchema } from '../schemas';
import type { GenerationStore } from '../store';

export function registerBattleRoutes(app: FastifyInstance, store: GenerationStore): void {
  app.post('/battles/:id/vote', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = voteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const result = store.recordVote(id, parsed.data);

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return reply.code(404).send({ error: 'not_found' });
      }
      if (result.reason === 'already_complete') {
        return reply.code(409).send({ error: 'already_complete' });
      }
      return reply.code(400).send({ error: 'invalid_axes', expectedAxes: result.expected });
    }

    if (result.bracketComplete) {
      return reply.send({
        status: 'bracket_complete',
        completedBattle: result.completedBattle,
        placement: result.placement,
        revealUrl: `/reveal/${result.generationId}`,
      });
    }

    return reply.send({
      status: 'battle_recorded',
      completedBattle: result.completedBattle,
      // 0 battles if the sibling semifinal (or final/consolation
      // counterpart) hasn't been voted on yet, 2 once it unlocks.
      unlockedBattles: result.unlockedBattles,
    });
  });
}
