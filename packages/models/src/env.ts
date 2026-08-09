/**
 * Every real adapter reads its API key through these helpers. The launch
 * brief has no real API keys yet, so `.env.example` ships `dummy-...`
 * values, and any value matching that shape is treated as "not configured"
 * rather than sent to a real API.
 */

export function readEnv(name: string): string | undefined {
  return process.env[name];
}

/** True for unset/empty values and for the `dummy-...` placeholders in `.env.example`. */
export function isPlaceholder(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return true;
  return value.trim().toLowerCase().startsWith("dummy-");
}
