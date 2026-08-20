import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TRACK_COLORS } from "@/lib/trackColors";
import { GENRES, SCOPES } from "@/lib/scopeGenre";
import type { Genre, Scope, TrackLetter } from "@/lib/api/types";

const SPARKS = [
  "A dreamy lo-fi beat for late-night studying, warm tape hiss",
  "Cinematic strings that build into a huge drum break",
  "Gritty 808 trap beat, half-time, dark piano loop",
];

const LETTERS: TrackLetter[] = ["A", "B", "C", "D"];

export interface GenerateScreenProps {
  prompt: string;
  setPrompt: (v: string) => void;
  scope: Scope;
  setScope: (v: Scope) => void;
  genre: Genre;
  setGenre: (v: Genre) => void;
  onSubmit: () => void;
}

export function GenerateScreen({ prompt, setPrompt, scope, setScope, genre, setGenre, onSubmit }: GenerateScreenProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="ambient-orange" />
      <div className="relative mx-auto max-w-[720px] px-6 pt-18 pb-24 font-body">
        <div className="rise mb-[18px] flex items-center gap-2.5">
          <span className="live-dot" />
          <span className="font-mono text-xs tracking-[0.12em] text-accent uppercase">4 models · 1 prompt · blind</span>
        </div>
        <h1 className="rise d1 mb-3.5 font-display text-4xl leading-[1.02] tracking-[-0.03em] text-text-heading">
          Make something.
          <br />
          <span className="text-accent">Then trust your ears.</span>
        </h1>
        <p className="rise d2 mb-[30px] max-w-[460px] text-md text-text-muted">
          Four models race your prompt. You judge them blind, head to head, and only then find out who made what.
        </p>

        <div className="rise d3 rounded-lg border border-border-strong bg-surface-card p-1 shadow-md transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-accent focus-within:shadow-[0_0_40px_rgba(255,90,31,0.22)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the track you hear in your head…"
            className="min-h-[104px] w-full resize-none border-none bg-transparent px-[18px] pt-[18px] pb-2 font-body text-md leading-normal text-text-heading outline-none"
          />
          <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
            {SPARKS.map((s, i) => (
              <button
                key={i}
                onClick={() => setPrompt(s)}
                className="cursor-pointer rounded-pill border border-dashed border-border-strong bg-transparent px-3 py-1.5 font-mono text-xs text-text-faint"
              >
                {s.slice(0, 30)}…
              </button>
            ))}
          </div>
        </div>

        <div className="rise d4 mt-7">
          <div className="eyebrow">Scope</div>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <Chip key={s.value} selected={scope === s.value} onClick={() => setScope(s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="rise d5 mt-[22px]">
          <div className="eyebrow">Genre</div>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <Chip key={g.value} selected={genre === g.value} onClick={() => setGenre(g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rise d6 mt-9 flex items-center gap-[18px]">
          <div className={prompt.trim() ? "cta-glow rounded-sm" : "rounded-sm"}>
            <Button size="lg" disabled={!prompt.trim()} onClick={onSubmit}>
              Start the race →
            </Button>
          </div>
          <div className="flex gap-1.5">
            {LETTERS.map((t) => (
              <span
                key={t}
                className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full font-mono text-[11px] font-bold text-[#0E0C0A] opacity-90"
                style={{ background: TRACK_COLORS[t] }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
