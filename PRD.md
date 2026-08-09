# Harmony — Product Requirements Document

## What Harmony is

Harmony is a blind, head-to-head comparison arena for AI music-generation models — the "LLM Arena / Design Arena" pattern applied to music. A listener describes what they want, gets several models' takes on it back-to-back without knowing which model made which, votes on their favorite through direct pairwise battles, and only afterward finds out who made what. Votes accumulate into public model leaderboards.

This PRD is derived from the working HTML prototype (`harmony-ux-prototype.html`), which was iterated through several rounds of hands-on feedback until the flow below felt right. It captures the validated user flow, not just the current UI polish — the visuals will keep evolving, but this sequence and its reasoning should hold.

## Prior decisions this PRD assumes

- **ToS-clean model roster only** — no models whose terms of service would be violated by running this kind of blind comparison/leaderboard.
- **Hybrid preference-vote mechanic** — not a single global rating; comparisons happen at the level of individual generations, judged pairwise.
- **4 models per generation** — all 4 generations participate in the battle-ladder ranking (3 rounds of 1v1 battles, not 4).
- **Model licensing preference: closed/proprietary preferred, open-source acceptable** — a closed roster is the stronger position for eventually reselling preference data (cleaner exclusivity), but if roster research shows the most ToS-viable options are mostly open-source, that's fine too. Either way, integration happens via API for now. Expect the roster to be actively refined as this research continues — this isn't a one-time decision.

## Core user flow (validated in prototype)

The flow is four steps, shown as a persistent, clickable step bar (steps unlock as you complete them, and you can always jump back — nothing is a dead end):

**1. Generate**
The user writes a free-text prompt describing the music they want, then narrows it with two chip groups:
- **Scope**: Full song / Just a beat / Vocal take / Instrumental only
- **Genre**: Pop / Lo-fi / Cinematic / Electronic / Jazz

These choices aren't cosmetic — they drive which comparison axes show up later (see step 2). Submitting kicks off generation for 4 models at once.

**2. Listen & Vote (merged step)**
Originally "listen" and "vote" were two separate steps; user feedback merged them into one, because splitting them made the wait feel dead and the transition into voting unclear. This step now does two things in sequence, using the *same* card component throughout so the transition feels continuous rather than a screen swap:

- **Loading/reveal phase**: all 4 tracks show as cards in a loading grid. Each card independently flips from a locked skeleton to "ready — waiting" as its generation finishes, so the user gets a visible sense of progress and which models are faster — but nothing is playable yet. Only once *all four* are ready do they unlock simultaneously. This was a deliberate fix for early confusion ("still don't know how to unlock this submit vote") — staggered unlocking felt broken; simultaneous unlocking after a visible wait felt intentional.
- **Battle phase**: once unlocked, comparison happens as a ladder of **1v1 battles**, not a single 4-way pick. The first track becomes the initial "champion" and faces track 2; the winner faces track 3; and so on for 3 rounds until one track has beaten all challengers. This replaced an earlier "pick your favorite of N" design — 1v1 was explicitly requested as more natural for judging ("i want the ability to pick like okay for this bass i like more, this quality of sound... this vocal, this instrumental").
- Each battle shows **contextual axis tags** generated from the step-1 choices — e.g. prompt match and production quality always show; vocals show unless scope was "Instrumental only"; bass/rhythm vs. melody emphasis depends on scope; genre-specific tags (synth work, improvisation) appear for Electronic/Jazz. Each axis gets its own Left/Tie/Right pill so the user can give fine-grained feedback beyond a single "which do you prefer" — plus an overall pick for the round.
- Everything here stays **blind** — tracks are labeled by letter, not by model name.

**3. Layers**
A stems/breakdown teaser (isolate vocals, bass, drums, etc. from the winning track). Deliberately placed *before* the reveal, not after — while the user still doesn't know which model made the winner, so the exploration stays part of the blind judgment rather than becoming "now that I know who won, let me poke at it."

**4. Reveal**
The final step: real model names are shown, the winning track is marked as "your favorite," and a taste-profile bar shows how the user's picks compare against the aggregate. This is the only point in the flow where model identity is revealed — everything upstream is protected from bias.

## Why this ordering, not a simpler one

- **Blind until the very end** is the core integrity mechanic — every design decision (staggered-but-gated loading, blind letter labels, layers-before-reveal) exists to protect it.
- **Merging listen+vote** and **simultaneous unlock** came directly from usability confusion in testing, not aesthetic preference — worth preserving if the flow is rebuilt from scratch.
- **1v1 battles over N-way ranking** scales better as the model roster grows (fixed comparison cost per round vs. combinatorial), and matches how people actually reason about audio ("A vs B, which do I prefer") better than absolute scoring.
- **Axis tags are contextual, not fixed** — they're derived from what the user actually asked for in step 1, so the comparison stays relevant to their intent instead of asking about e.g. vocals on an instrumental-only request.

## Open / not yet decided

- Exact leaderboard mechanics beyond the per-session taste-profile bar (global ranking algorithm, Elo/Bradley-Terry vs. simple win-rate, how ties are weighted).
- Account/identity system — the prototype has no auth; whether voting requires an account, and what (if anything) is gated behind one.
- Monetization / rate-limiting on generation (4 models per prompt is not free to run at scale).
- How new models get onboarded into the roster over time given the ToS-clean and licensing-preference constraints above.

## Technical considerations (pointer, not full spec)

Full architecture research lives separately (Firstmate repo, `.lavish/harmony-tech-stack-research.html`) — this is just enough to keep in view while product decisions get made:

- Architecturally the platform is "LMSYS Chatbot Arena, adapted to async audio jobs" — the hard part isn't the plumbing, it's the **model access layer**: the most recognizable consumer brands (Suno, Udio) are the worst ToS fit, which is why the roster decision above matters.
- 6 ToS-clean models were identified as a viable v1 roster (Stable Audio, Lyria 2, ElevenLabs, MiniMax, ACE-Step, YuE) — the roster in the live product will be a subset of 4, actively refined.
- Recommended starting stack ("Candidate A — managed-first"): Next.js + wavesurfer.js frontend over SSE, Node/TS backend, Inngest/Trigger.dev for fan-out orchestration, hosted APIs first (self-hosted GPU only once volume justifies it), Cloudflare R2 + Postgres for storage. A "Candidate B — more control" path (Temporal, self-managed GPU fleet) is the natural evolution once cost/volume justify the ops burden — not a starting point.
- Progressive reveal (each model card renders immediately and populates independently, never batched) is called out as directly matching the product's step-2 loading behavior above.
- Preference-vote data schema is intentionally shaped like LMSYS's Bradley-Terry aggregation, since the eventual resale value of that preference data was flagged as part of the business case — which is also why a closed/proprietary-leaning roster is preferred where viable.

---

## Future feature: layer mixing/matching across recordings

Not scoped for v1, but worth capturing: a future flow where a user could take a *layer* (e.g. a bassline, a vocal take, a drum pattern) from one generated recording and have it analyzed and matched up against layers from other recordings — mixing and matching stems across different generations rather than treating each recording as a sealed unit. This is a distinct, likely more complex user flow from the core arena above (it implies layer-level analysis/compatibility matching, not just isolation/playback), and would build on the same stems/layers foundation introduced in step 3. Flagging for future exploration once the core arena flow is validated.

## Future feature: Sync Studio (video-editor niche)

A separate exploratory mock (`harmony-niche-syncstudio.html` in the Firstmate `.lavish/` prototypes) adapted the core Harmony arena for a specific niche — short-form video editors (TikTok/Reels/Shorts) — as a way to think about vertical-specific engagement hooks beyond the general arena. Not scheduled for the initial build; noting the concept here so it isn't lost.

**Concept**: instead of comparing generations in the abstract, the user marks up to 3 beat/cut points on a mock video timeline and picks a target length (15s/30s/60s). The same multi-model generation step runs, but the comparison changes shape: rather than pairwise battles, all tracks are auditioned against the **same fixed timeline** via track tabs and an animated playhead, so the user is judging "which track cuts best to my footage," not just "which track sounds best." Each track gets two 1–5 ratings — Vibe fit and Sync fit — and the highest combined score wins. The layers/stems step gets reframed too: instead of a generic breakdown, it's framed as stems for ducking music under dialogue. Ends in a mock "export project" step instead of a generic reveal.

**Why it's interesting**: it's a plausible wedge into a specific, high-engagement niche (video editors have a constant, recurring need for background music, vs. the general arena's one-off curiosity use) without abandoning the blind-comparison core mechanic — it's the same underlying arena, re-shaped around one audience's actual workflow. Worth revisiting once the core arena is validated.
