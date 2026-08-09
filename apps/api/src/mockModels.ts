import type { MockModel } from './types';

/**
 * ToS-clean v1 roster candidates named in PRD.md's technical-considerations
 * section. Real roster wiring (and actual audio generation) lands with
 * packages/models — this list only exists so the mock data layer has
 * something plausible to reveal at the end of the ladder.
 */
export const MODEL_ROSTER: MockModel[] = [
  { id: 'stable-audio-2-5', name: 'Stable Audio 2.5' },
  { id: 'lyria-2', name: 'Lyria 2' },
  { id: 'elevenlabs-music', name: 'ElevenLabs Music' },
  { id: 'minimax-music-01', name: 'MiniMax Music-01' },
  { id: 'ace-step', name: 'ACE-Step' },
  { id: 'yue', name: 'YuE' },
];

export function pickFourModels(): MockModel[] {
  const shuffled = [...MODEL_ROSTER].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}
