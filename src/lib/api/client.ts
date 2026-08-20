import type {
  AllReadyEvent,
  GenerateResponse,
  GenerationFailedEvent,
  Genre,
  LayersResponse,
  RevealResponse,
  Scope,
  TrackReadyEvent,
  VoteRequest,
  VoteResponse,
} from "./types";

// Local mock by default so frontend work isn't blocked on harmony-backend's
// deploy status. Point NEXT_PUBLIC_API_BASE_URL at a real backend (no trailing
// slash) to switch over — same contract, same paths.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/mock";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function generate(prompt: string, scope: Scope, genre: Genre) {
  return apiFetch<GenerateResponse>("/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, scope, genre }),
  });
}

export function vote(battleId: string, body: VoteRequest) {
  return apiFetch<VoteResponse>(`/battles/${battleId}/vote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getLayers(trackId: string) {
  return apiFetch<LayersResponse>(`/layers/${trackId}`);
}

export function getReveal(generationId: string) {
  return apiFetch<RevealResponse>(`/reveal/${generationId}`);
}

export interface GenerationEventHandlers {
  onTrackReady?: (event: TrackReadyEvent) => void;
  onAllReady?: (event: AllReadyEvent) => void;
  onGenerationFailed?: (event: GenerationFailedEvent) => void;
  onError?: (err: Event) => void;
}

// eventsUrl comes straight from the /generate response — already the
// correct absolute-or-relative path for whichever base is active.
export function subscribeToGenerationEvents(eventsUrl: string, handlers: GenerationEventHandlers) {
  const source = new EventSource(eventsUrl);
  source.addEventListener("track-ready", (e) => {
    handlers.onTrackReady?.(JSON.parse((e as MessageEvent).data));
  });
  source.addEventListener("all-ready", (e) => {
    handlers.onAllReady?.(JSON.parse((e as MessageEvent).data));
  });
  source.addEventListener("generation-failed", (e) => {
    handlers.onGenerationFailed?.(JSON.parse((e as MessageEvent).data));
  });
  source.onerror = (e) => handlers.onError?.(e);
  return () => source.close();
}
