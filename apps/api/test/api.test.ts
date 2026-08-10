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

function voteAxes(battle: any, pick: 'left' | 'tie' | 'right') {
  return Object.fromEntries(battle.axes.map((a: any) => [a.key, pick]));
}

describe('Harmony API', () => {
  it('runs the full generate -> SSE -> 4-battle bracket -> reveal -> layers flow', async () => {
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

    const openBattles = allReadyEvent!.data.openBattles;
    expect(openBattles).toHaveLength(2);
    const semi1 = openBattles.find((b: any) => b.slot === 1);
    const semi2 = openBattles.find((b: any) => b.slot === 2);
    expect(semi1.stage).toBe('semifinal');
    expect(semi2.stage).toBe('semifinal');
    // Semi1 is A vs B, semi2 is C vs D.
    expect([semi1.left.letter, semi1.right.letter].sort()).toEqual(['A', 'B']);
    expect([semi2.left.letter, semi2.right.letter].sort()).toEqual(['C', 'D']);

    // Vote semi1: nothing unlocks yet, semi2 hasn't been voted on.
    const semi1VoteRes = await app.inject({
      method: 'POST',
      url: `/battles/${semi1.id}/vote`,
      payload: { overall: 'left', axes: voteAxes(semi1, 'left') },
    });
    expect(semi1VoteRes.statusCode).toBe(200);
    const semi1Body = semi1VoteRes.json();
    expect(semi1Body.status).toBe('battle_recorded');
    expect(semi1Body.unlockedBattles).toHaveLength(0);
    const semi1Winner = semi1Body.completedBattle.winnerTrackId;
    const semi1Loser = semi1Body.completedBattle.loserTrackId;

    // Vote semi2: this is the second semifinal to finish, so both the
    // final and the consolation match unlock at once.
    const semi2VoteRes = await app.inject({
      method: 'POST',
      url: `/battles/${semi2.id}/vote`,
      payload: { overall: 'right', axes: voteAxes(semi2, 'right') },
    });
    expect(semi2VoteRes.statusCode).toBe(200);
    const semi2Body = semi2VoteRes.json();
    expect(semi2Body.unlockedBattles).toHaveLength(2);
    const semi2Winner = semi2Body.completedBattle.winnerTrackId;
    const semi2Loser = semi2Body.completedBattle.loserTrackId;

    const final = semi2Body.unlockedBattles.find((b: any) => b.stage === 'final');
    const consolation = semi2Body.unlockedBattles.find((b: any) => b.stage === 'consolation');
    expect(final).toBeTruthy();
    expect(consolation).toBeTruthy();
    expect([final.left.trackId, final.right.trackId].sort()).toEqual([semi1Winner, semi2Winner].sort());
    expect([consolation.left.trackId, consolation.right.trackId].sort()).toEqual(
      [semi1Loser, semi2Loser].sort(),
    );

    // Vote the final: bracket isn't complete yet, consolation is still open.
    const finalVoteRes = await app.inject({
      method: 'POST',
      url: `/battles/${final.id}/vote`,
      payload: { overall: 'left', axes: voteAxes(final, 'left') },
    });
    const finalBody = finalVoteRes.json();
    expect(finalBody.status).toBe('battle_recorded');

    // Vote the consolation match: this is the last battle, bracket completes.
    const consolationVoteRes = await app.inject({
      method: 'POST',
      url: `/battles/${consolation.id}/vote`,
      payload: { overall: 'right', axes: voteAxes(consolation, 'right') },
    });
    expect(consolationVoteRes.statusCode).toBe(200);
    const consolationBody = consolationVoteRes.json();
    expect(consolationBody.status).toBe('bracket_complete');
    const placement = consolationBody.placement;
    expect(placement.first.track.id).toBe(finalBody.completedBattle.winnerTrackId);
    expect(placement.second.track.id).toBe(finalBody.completedBattle.loserTrackId);
    expect(placement.third.track.id).toBe(consolationBody.completedBattle.winnerTrackId);
    expect(placement.fourth.track.id).toBe(consolationBody.completedBattle.loserTrackId);

    const revealRes = await app.inject({ method: 'GET', url: `/reveal/${generated.generationId}` });
    expect(revealRes.statusCode).toBe(200);
    const revealed = revealRes.json();
    expect(revealed.placement.first.track.id).toBe(placement.first.track.id);
    expect(revealed.placement.first.model.name).toBeTruthy();

    const layersRes = await app.inject({ method: 'GET', url: `/layers/${placement.first.track.id}` });
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

  it('returns 409 on reveal before the bracket is complete, 404 for unknown ids', async () => {
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
    const battle = allReadyEvent.data.openBattles[0];

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
