import type { Vote } from "@/lib/api/types";

export interface VotePillProps {
  axis: string;
  value?: Vote;
  onVote?: (v: Vote) => void;
  leftColor?: string;
  rightColor?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function VotePill({
  axis,
  value,
  onVote,
  leftColor = "var(--accent)",
  rightColor = "var(--accent)",
  leftLabel = "A",
  rightLabel = "B",
}: VotePillProps) {
  const opts: { key: Vote; label: string }[] = [
    { key: "left", label: leftLabel },
    { key: "tie", label: "Tie" },
    { key: "right", label: rightLabel },
  ];
  const colorFor = (k: Vote) => (k === "tie" ? "var(--secondary)" : k === "left" ? leftColor : rightColor);
  return (
    <div className="flex items-center justify-between gap-3 font-body">
      <span className="text-sm text-text-muted">{axis}</span>
      <div className="flex gap-1 rounded-pill border border-border-default bg-surface-card p-[3px]">
        {opts.map((o) => {
          const active = value === o.key;
          const color = colorFor(o.key);
          return (
            <button
              key={o.key}
              onClick={() => onVote?.(o.key)}
              className="min-w-[34px] cursor-pointer rounded-pill border-none px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[0.04em] transition-all duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: active ? color : "transparent",
                color: active ? "#0E0C0A" : "var(--text-muted)",
                boxShadow: active ? `0 0 18px ${color}55` : "none",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
