"use client";
import React from "react";
import { BattleScreen, type ListenBattleResult } from "@/components/screens/BattleScreen";
import { GenerateScreen } from "@/components/screens/GenerateScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";
import { StepBar } from "@/components/ui/StepBar";
import type { Genre, Scope } from "@/lib/api/types";

const STEPS = ["Generate", "Listen & Battle", "Results"];

export default function Home() {
  const [step, setStep] = React.useState(0);
  const [unlocked, setUnlocked] = React.useState(0);
  const [prompt, setPrompt] = React.useState("");
  const [scope, setScope] = React.useState<Scope>("full_song");
  const [genre, setGenre] = React.useState<Genre>("lofi");
  const [result, setResult] = React.useState<ListenBattleResult | null>(null);
  // Bumped on every fresh run so BattleScreen remounts with clean internal state.
  const [runKey, setRunKey] = React.useState(0);

  function goTo(i: number) {
    if (i <= unlocked) setStep(i);
  }
  function advance(i: number) {
    setUnlocked((u) => Math.max(u, i));
    setStep(i);
  }

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "rgba(14,12,10,0.86)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border-default)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 5,
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-heading)", letterSpacing: "-0.02em" }}>
          Harmony
        </span>
        <StepBar steps={STEPS} activeIndex={step} unlockedCount={unlocked} onStepClick={goTo} />
      </div>

      {step === 0 && (
        <GenerateScreen prompt={prompt} setPrompt={setPrompt} scope={scope} setScope={setScope} genre={genre} setGenre={setGenre} onSubmit={() => advance(1)} />
      )}
      {step === 1 && (
        <BattleScreen
          key={runKey}
          prompt={prompt}
          scope={scope}
          genre={genre}
          onComplete={(r) => {
            setResult(r);
            advance(2);
          }}
          onRetry={() => setStep(0)}
        />
      )}
      {step === 2 && result && (
        <ResultsScreen
          placement={result.placement}
          prompt={prompt}
          scope={scope}
          genre={genre}
          trackAudioUrls={result.trackAudioUrls}
          onRestart={() => {
            setUnlocked(0);
            setStep(0);
            setPrompt("");
            setResult(null);
            setRunKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
