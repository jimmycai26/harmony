"use client";
import React from "react";
import WaveSurfer from "wavesurfer.js";

export interface WaveformPlayerProps {
  src: string;
  label?: string;
  playing: boolean;
  onTogglePlay: () => void;
  color?: string;
  height?: number;
  meter?: boolean;
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function WaveformPlayer({ src, label, playing, onTogglePlay, color = "var(--accent)", height = 44, meter = false }: WaveformPlayerProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [wsPlaying, setWsPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current || !wrapRef.current) return;
    // color lives on the wrapper via inline style specifically so this resolves
    // any var() reference to a concrete value wavesurfer's canvas can use.
    const resolvedColor = getComputedStyle(wrapRef.current).color;
    const idleColor = getComputedStyle(document.documentElement).getPropertyValue("--border-strong").trim() || "#2A2622";

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor: idleColor,
      progressColor: resolvedColor,
      cursorColor: resolvedColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1.5,
      barRadius: 1,
      normalize: true,
      url: src,
    });
    wsRef.current = ws;

    ws.on("ready", (d) => setDuration(d));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("play", () => setWsPlaying(true));
    ws.on("pause", () => setWsPlaying(false));
    ws.on("finish", () => setWsPlaying(false));

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [src, height]);

  React.useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (playing && !ws.isPlaying()) void ws.play();
    if (!playing && ws.isPlaying()) ws.pause();
  }, [playing]);

  return (
    <div ref={wrapRef} className="flex items-center gap-3.5 font-body" style={{ color }}>
      <button
        onClick={onTogglePlay}
        aria-label={wsPlaying ? "Pause" : "Play"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-none text-sm transition-[background,box-shadow] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          cursor: "pointer",
          background: wsPlaying ? color : "var(--border-strong)",
          color: wsPlaying ? "#0E0C0A" : "var(--warm-white)",
          boxShadow: wsPlaying ? `0 0 26px color-mix(in srgb, ${color} 45%, transparent)` : "none",
        }}
      >
        {wsPlaying ? "❙❙" : "▶"}
      </button>
      <div ref={containerRef} className="min-w-0 flex-1 cursor-pointer" />
      {meter && (
        <span
          className="relative shrink-0 overflow-hidden rounded-[2px] bg-[color-mix(in_srgb,var(--border-strong)_70%,transparent)]"
          style={{ width: 4, height: Math.min(34, height) }}
        >
          <i className={`wf-meter-fill${wsPlaying ? " is-playing" : ""}`} />
        </span>
      )}
      <span
        className="shrink-0 text-right font-mono text-xs text-text-faint"
        style={{ minWidth: label ? 38 : 0 }}
      >
        {label ?? (duration ? fmt(currentTime || duration) : "")}
      </span>
    </div>
  );
}
