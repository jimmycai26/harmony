import type { CSSProperties } from "react";

export type ListenerAvatarVariant = "headphones" | "vinyl" | "equalizer" | "note";

export interface ListenerAvatarProps {
  color: string;
  variant: ListenerAvatarVariant;
  delayMs?: number;
}

// Illustrated "listener" mascots, not stock photos — real headshots here
// would read as fake testimonials from people who never signed up. Bold,
// glowing glyphs rather than a cute cartoon face, so they read as icon
// badges instead of children's-app characters.
export function ListenerAvatar({ color, variant, delayMs = 0 }: ListenerAvatarProps) {
  const glow: CSSProperties = { filter: `drop-shadow(0 0 4px ${color})` };

  return (
    <span className="wl-avatar" style={{ animationDelay: `${delayMs}ms` }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="var(--black-1)" />
        <g style={glow}>
          {variant === "headphones" && (
            <>
              <path d="M5.4 12.6a6.6 6.6 0 0 1 13.2 0" stroke={color} strokeWidth="2.3" fill="none" strokeLinecap="round" />
              <rect x="4.1" y="11.8" width="2.7" height="5.2" rx="1.35" fill={color} />
              <rect x="17.2" y="11.8" width="2.7" height="5.2" rx="1.35" fill={color} />
            </>
          )}
          {variant === "vinyl" && (
            <g className="wl-avatar-spin">
              <circle cx="12" cy="12" r="7" fill="none" stroke={color} strokeWidth="2" />
              <circle cx="12" cy="12" r="2.4" fill={color} />
              <circle cx="12" cy="5.6" r="1.15" fill={color} />
            </g>
          )}
          {variant === "equalizer" && (
            <>
              <rect className="wl-avatar-eq" x="7.3" y="12" width="2.5" height="5.4" rx="1.25" fill={color} style={{ animationDelay: `${delayMs}ms` }} />
              <rect
                className="wl-avatar-eq"
                x="10.75"
                y="7.2"
                width="2.5"
                height="10.2"
                rx="1.25"
                fill={color}
                style={{ animationDelay: `${delayMs + 130}ms` }}
              />
              <rect
                className="wl-avatar-eq"
                x="14.2"
                y="9.4"
                width="2.5"
                height="8"
                rx="1.25"
                fill={color}
                style={{ animationDelay: `${delayMs + 260}ms` }}
              />
            </>
          )}
          {variant === "note" && (
            <g className="wl-avatar-note">
              <circle cx="9.1" cy="16.1" r="2.5" fill={color} />
              <rect x="11" y="6.3" width="1.6" height="9.8" rx="0.5" fill={color} />
              <path d="M12.6 6.3c2.2-.6 3.9.4 3.9 2.4" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
