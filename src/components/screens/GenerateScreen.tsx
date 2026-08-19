"use client";
import React from "react";
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
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div className="ambient-orange" />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 24px 96px", fontFamily: "var(--font-body)", position: "relative" }}>
        <div className="rise" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span className="live-dot" />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            4 models · 1 prompt · blind
          </span>
        </div>
        <h1
          className="rise d1"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", lineHeight: 1.02, color: "var(--text-heading)", marginBottom: 14, letterSpacing: "-0.03em" }}
        >
          Make something.
          <br />
          <span style={{ color: "var(--accent)" }}>Then trust your ears.</span>
        </h1>
        <p className="rise d2" style={{ color: "var(--text-muted)", fontSize: "var(--text-md)", marginBottom: 30, maxWidth: 460 }}>
          Four models race your prompt. You judge them blind, head to head, and only then find out who made what.
        </p>

        <div
          className="rise d3"
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-lg)",
            padding: 4,
            border: `1px solid ${focus ? "var(--accent)" : "var(--border-strong)"}`,
            boxShadow: focus ? "0 0 40px rgba(255,90,31,0.22)" : "var(--shadow-md)",
            transition: "all var(--duration-base) var(--ease-out)",
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            placeholder="Describe the track you hear in your head…"
            style={{
              width: "100%",
              minHeight: 104,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              padding: "18px 18px 8px",
              color: "var(--text-heading)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-md)",
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", gap: 8, padding: "0 14px 14px", flexWrap: "wrap" }}>
            {SPARKS.map((s, i) => (
              <button
                key={i}
                onClick={() => setPrompt(s)}
                style={{
                  background: "transparent",
                  border: "1px dashed var(--border-strong)",
                  color: "var(--text-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                }}
              >
                {s.slice(0, 30)}…
              </button>
            ))}
          </div>
        </div>

        <div className="rise d4" style={{ marginTop: 28 }}>
          <div className="eyebrow">Scope</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SCOPES.map((s) => (
              <Chip key={s.value} selected={scope === s.value} onClick={() => setScope(s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="rise d5" style={{ marginTop: 22 }}>
          <div className="eyebrow">Genre</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {GENRES.map((g) => (
              <Chip key={g.value} selected={genre === g.value} onClick={() => setGenre(g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rise d6" style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 18 }}>
          <div className={prompt.trim() ? "cta-glow" : ""} style={{ borderRadius: "var(--radius-sm)" }}>
            <Button size="lg" disabled={!prompt.trim()} onClick={onSubmit}>
              Start the race →
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {LETTERS.map((t) => (
              <span
                key={t}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: TRACK_COLORS[t],
                  opacity: 0.9,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0E0C0A",
                }}
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
