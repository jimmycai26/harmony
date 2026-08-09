import type { AxisKey, Genre, Scope } from './types';

export const AXIS_LABELS: Record<AxisKey, string> = {
  prompt_match: 'Prompt match',
  production_quality: 'Production quality',
  vocals: 'Vocals',
  bass_rhythm: 'Bass & rhythm',
  melody: 'Melody',
  synth_work: 'Synth work',
  improvisation: 'Improvisation',
};

/**
 * Contextual axis logic from PRD.md step 2: prompt match and production
 * quality always apply; vocals drop out for instrumental-only scope; the
 * rhythm/melody axis flips on whether the scope is beat-first; genre adds
 * one specialist axis for electronic and jazz.
 */
export function computeAxes(scope: Scope, genre: Genre): AxisKey[] {
  const axes: AxisKey[] = ['prompt_match', 'production_quality'];

  if (scope !== 'instrumental') {
    axes.push('vocals');
  }

  axes.push(scope === 'beat' ? 'bass_rhythm' : 'melody');

  if (genre === 'electronic') {
    axes.push('synth_work');
  }
  if (genre === 'jazz') {
    axes.push('improvisation');
  }

  return axes;
}
