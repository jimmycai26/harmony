import Fastify, { type FastifyInstance } from 'fastify';
import { registerBattleRoutes } from './routes/battles';
import { registerGenerateRoutes } from './routes/generate';
import { registerLayersRoutes } from './routes/layers';
import { registerRevealRoutes } from './routes/reveal';
import { InMemoryGenerationStore, type GenerationStore } from './store';

export interface BuildAppOptions {
  store?: GenerationStore;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const store = options.store ?? new InMemoryGenerationStore();

  app.get('/health', async () => ({ status: 'ok' }));

  registerGenerateRoutes(app, store);
  registerBattleRoutes(app, store);
  registerLayersRoutes(app, store);
  registerRevealRoutes(app, store);

  return app;
}
