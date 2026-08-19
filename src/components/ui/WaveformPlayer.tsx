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
    <div ref={wrapRef} style={{ display: "flex", alignItems: "center", gap: "14px", fontFamily: "var(--font-body)", color }}>
      <button
        onClick={onTogglePlay}
        aria-label={wsPlaying ? "Pause" : "Play"}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          background: wsPlaying ? color : "var(--border-strong)",
          color: wsPlaying ? "#0E0C0A" : "var(--warm-white)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          boxShadow: wsPlaying ? `0 0 26px color-mix(in srgb, ${color} 45%, transparent)` : "none",
          transition: "background var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)",
        }}
      >
        {wsPlaying ? "❙❙" : "▶"}
      </button>
      <div ref={containerRef} style={{ flex: "1 1 0", minWidth: 0, cursor: "pointer" }} />
      {meter && (
        <span
          style={{
            width: 4,
            height: Math.min(34, height),
            borderRadius: 2,
            background: "color-mix(in srgb, var(--border-strong) 70%, transparent)",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <i className={`wf-meter-fill${wsPlaying ? " is-playing" : ""}`} />
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          color: "var(--text-faint)",
          flexShrink: 0,
          minWidth: label ? 38 : 0,
          textAlign: "right",
        }}
      >
        {label ?? (duration ? fmt(currentTime || duration) : "")}
      </span>
    </div>
  );
}
