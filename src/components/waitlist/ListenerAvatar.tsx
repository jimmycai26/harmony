export interface ListenerAvatarProps {
  color: string;
  delayMs?: number;
}

// Illustrated "listener" mascot — not a stock photo. Real headshots here
// would read as fake testimonials from people who never signed up; this
// stays honest while still feeling more alive than a lettered circle.
export function ListenerAvatar({ color, delayMs = 0 }: ListenerAvatarProps) {
  return (
    <span className="wl-avatar" style={{ background: color, animationDelay: `${delayMs}ms` }}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path d="M6 11a6 6 0 0 1 12 0" stroke="#0E0C0A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <rect x="4.4" y="10.4" width="2.2" height="4" rx="1.1" fill="#0E0C0A" />
        <rect x="17.4" y="10.4" width="2.2" height="4" rx="1.1" fill="#0E0C0A" />
        <circle cx="12" cy="13.5" r="5.6" fill="#0E0C0A" fillOpacity="0.88" />
        <circle className="wl-avatar-eye" cx="9.7" cy="13" r="1" fill="#F5F1E8" style={{ animationDelay: `${delayMs}ms` }} />
        <circle className="wl-avatar-eye" cx="14.3" cy="13" r="1" fill="#F5F1E8" style={{ animationDelay: `${delayMs + 90}ms` }} />
        <path d="M9.4 16.2c1 .9 4.2 .9 5.2 0" stroke="#F5F1E8" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
