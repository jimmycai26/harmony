import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { InMemoryGenerationStore } from '../src/store';

interface SseFrame {
  event: string;
  data: any;
}

function parseSse(payload: string): SseFrame[] {
  return payload
    .split('\n\n')
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const lines = chunk.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event: '));
      const dataLine = lines.find((l) => l.startsWith('data: '));
      return {
        event: eventLine?.slice('event: '.length) ?? '',
        data: dataLine ? JSON.parse(dataLine.slice('data: '.length)) : undefined,
      };
    })
    .filter((frame) => frame.event);
}

describe('Harmony API', () => {
  it('runs the full generate -> SSE -> ladder -> reveal -> layers flow', async () => {
    const store = new InMemoryGenerationStore({ trackDelayMs: { min: 10, max: 40 } });
    const app = buildApp({ store, logger: false });

    const generateRes = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { prompt: 'a dreamy synthwave night drive', scope: 'full_song', genre: 'electronic' },
    });
    expect(generateRes.statusCode).toBe(201);
    const generated = generateRes.json();
    expect(generated.tracks).toHaveLength(4);
    expect(generated.axes.map((a: any) => a.key)).toContain('synth_work');
    expect(generated.axes.map((a: any) => a.key)).toContain('vocals');

    const eventsRes = await app.inject({ method: 'GET', url: `/generate/${generated.generationId}/events` });
    expect(eventsRes.statusCode).toBe(200);
    const events = parseSse(eventsRes.payload);
    const trackReadyEvents = events.filter((e) => e.event === 'track-ready');
    const allReadyEvent = events.find((e) => e.event === 'all-ready');
    expect(trackReadyEvents).toHaveLength(4);
    expect(allReadyEvent).toBeTruthy();
    expect(allReadyEvent!.data.firstBattle.round).toBe(1);

    let battle = allReadyEvent!.data.firstBattle;
    let round = 0;
    let winner: { trackId: string; letter: string } | undefined;

    while (!winner) {
      const voteRes = await app.inject({
        method: 'POST',
        url: `/battles/${battle.id}/vote`,
        payload: {
          overall: 'left',
          axes: Object.fromEntries(battle.axes.map((a: any) => [a.key, 'left'])),
        },
      });
      expect(voteRes.statusCode).toBe(200);
      const body = voteRes.json();
      round += 1;
      if (body.status === 'ladder_complete') {
        winner = body.winner;
      } else {
        battle = body.nextBattle;
      }
    }

    expect(round).toBe(3);
    // Left always wins here, so the round-1 left track (A) should be champion.
    expect(winner!.letter).toBe('A');

    const revealRes = await app.inject({ method: 'GET', url: `/reveal/${generated.generationId}` });
    expect(revealRes.statusCode).toBe(200);
    const revealed = revealRes.json();
    expect(revealed.winningTrack.id).toBe(winner!.trackId);
    expect(revealed.model.name).toBeTruthy();

    const layersRes = await app.inject({ method: 'GET', url: `/layers/${winner!.trackId}` });
    expect(layersRes.statusCode).toBe(200);
    expect(layersRes.json().stems).toHaveLength(4);

    await app.close();
  });

  it('rejects invalid generate payloads', async () => {
    const app = buildApp({ logger: false });
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { prompt: '', scope: 'nope', genre: 'pop' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('omits the vocals axis for instrumental-only scope', async () => {
    const app = buildApp({ logger: false });
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { prompt: 'test', scope: 'instrumental', genre: 'lofi' },
    });
    const body = res.json();
    expect(body.axes.map((a: any) => a.key)).not.toContain('vocals');
    expect(body.axes.map((a: any) => a.key)).toContain('melody');
    await app.close();
  });

  it('returns 409 on reveal before the ladder is complete, 404 for unknown ids', async () => {
    const store = new InMemoryGenerationStore({ trackDelayMs: { min: 5, max: 10 } });
    const app = buildApp({ store, logger: false });

    const generateRes = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { prompt: 'test', scope: 'beat', genre: 'jazz' },
    });
    const { generationId } = generateRes.json();

    const revealRes = await app.inject({ method: 'GET', url: `/reveal/${generationId}` });
    expect(revealRes.statusCode).toBe(409);

    const missingRes = await app.inject({ method: 'GET', url: '/reveal/does-not-exist' });
    expect(missingRes.statusCode).toBe(404);

    await app.close();
  });

  it('rejects a vote missing required axis picks', async () => {
    const store = new InMemoryGenerationStore({ trackDelayMs: { min: 10, max: 20 } });
    const app = buildApp({ store, logger: false });

    const generateRes = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { prompt: 'test', scope: 'full_song', genre: 'pop' },
    });
    const generated = generateRes.json();
    const eventsRes = await app.inject({ method: 'GET', url: `/generate/${generated.generationId}/events` });
    const allReadyEvent = parseSse(eventsRes.payload).find((e) => e.event === 'all-ready')!;
    const battle = allReadyEvent.data.firstBattle;

    const voteRes = await app.inject({
      method: 'POST',
      url: `/battles/${battle.id}/vote`,
      payload: { overall: 'left', axes: {} },
    });
    expect(voteRes.statusCode).toBe(400);
    expect(voteRes.json().error).toBe('invalid_axes');

    await app.close();
  });
});
