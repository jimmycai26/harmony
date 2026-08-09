import { z } from 'zod';

export const scopeSchema = z.enum(['full_song', 'beat', 'vocal', 'instrumental']);
export const genreSchema = z.enum(['pop', 'lofi', 'cinematic', 'electronic', 'jazz']);
export const pickSchema = z.enum(['left', 'tie', 'right']);

export const generateBodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'prompt is required')
    .max(500, 'prompt must be 500 characters or fewer'),
  scope: scopeSchema,
  genre: genreSchema,
});

export const voteBodySchema = z.object({
  overall: pickSchema,
  axes: z.record(z.string(), pickSchema),
});
