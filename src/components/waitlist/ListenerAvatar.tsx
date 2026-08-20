import type { CSSProperties } from "react";

export type ListenerAvatarVariant = "headphones" | "vinyl" | "equalizer" | "note";

export interface ListenerAvatarProps {
  color: string;
  variant: ListenerAvatarVariant;
  delayMs?: number;
}

// Illustrated "listener" mascots, not stock photos — real headshots here
// would read as fake testimonials from people who never signed up. Four
// small musician-flavored glyphs (headphones / vinyl / EQ / note) instead
// of one repeated icon, each animated in its own way.
export function ListenerAvatar({ color, variant, delayMs = 0 }: ListenerAvatarProps) {
  return (
    <span
      className="wl-avatar"
      style={{ "--avatar-color": color, animationDelay: `${delayMs}ms` } as CSSProperties}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" fill="var(--black-1)" />
        {variant === "headphones" && (
          <>
            <path d="M6 11a6 6 0 0 1 12 0" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <rect x="4.6" y="10.4" width="2" height="3.8" rx="1" fill={color} />
            <rect x="17.4" y="10.4" width="2" height="3.8" rx="1" fill={color} />
            <circle cx="9.8" cy="13" r="0.9" className="wl-avatar-eye" fill={color} style={{ animationDelay: `${delayMs}ms` }} />
            <circle cx="14.2" cy="13" r="0.9" className="wl-avatar-eye" fill={color} style={{ animationDelay: `${delayMs + 90}ms` }} />
            <path d="M9.5 15.7c.9.8 3.8.8 4.7 0" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round" />
          </>
        )}
        {variant === "vinyl" && (
          <g className="wl-avatar-spin">
            <circle cx="12" cy="12" r="5.4" fill="none" stroke={color} strokeWidth="0.7" opacity="0.55" />
            <circle cx="12" cy="12" r="3.6" fill="none" stroke={color} strokeWidth="0.7" opacity="0.4" />
            <circle cx="12" cy="6.9" r="0.85" fill={color} />
            <circle cx="12" cy="12" r="1.7" fill={color} />
          </g>
        )}
        {variant === "equalizer" && (
          <>
            <rect className="wl-avatar-eq" x="8.2" y="12" width="1.7" height="4" rx="0.85" fill={color} style={{ animationDelay: `${delayMs}ms` }} />
            <rect className="wl-avatar-eq" x="11.15" y="8.5" width="1.7" height="7.5" rx="0.85" fill={color} style={{ animationDelay: `${delayMs + 120}ms` }} />
            <rect className="wl-avatar-eq" x="14.1" y="10.5" width="1.7" height="5.5" rx="0.85" fill={color} style={{ animationDelay: `${delayMs + 240}ms` }} />
          </>
        )}
        {variant === "note" && (
          <g className="wl-avatar-note">
            <circle cx="9.6" cy="15.4" r="1.9" fill={color} />
            <rect x="11.1" y="7.2" width="1.15" height="8.3" fill={color} />
            <path d="M12.2 7.2c1.7-.5 3 .3 3 1.9" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </span>
  );
}
