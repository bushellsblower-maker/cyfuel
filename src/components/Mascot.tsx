import type { Mood } from "../lib/quips";

export function Mascot({ mood }: { mood: Mood }) {
  const mouth =
    mood === "ouch"
      ? "M14 30 Q21 26 28 30"
      : mood === "hunt"
        ? "M15 29 H27"
        : mood === "clever"
          ? "M14 28 Q21 34 28 28"
          : "M14 28 Q21 33 28 28";
  const eyes = mood === "hunt" ? 1.1 : 1.6;
  return (
    <svg className={`mascot mascot-${mood}`} viewBox="0 0 72 78" role="img" aria-label="Pip the pump">
      <ellipse cx="36" cy="72" rx="16" ry="4" fill="#24170f" opacity="0.15" />
      <rect x="16" y="24" width="34" height="42" rx="7" fill="#ff5d3a" stroke="#24170f" strokeWidth="3" />
      <rect x="22" y="30" width="22" height="14" rx="3" fill="#fff8ee" stroke="#24170f" strokeWidth="2.5" />
      <circle cx="28" cy="36" r={eyes} fill="#24170f" />
      <circle cx="38" cy="36" r={eyes} fill="#24170f" />
      <path d={mouth} fill="none" stroke="#24170f" strokeWidth="2" strokeLinecap="round" />
      <rect x="46" y="36" width="10" height="6" rx="2" fill="#24170f" />
      <path d="M56 39 v14 q0 8 -8 8" fill="none" stroke="#24170f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="61" r="3" fill="#ffd447" stroke="#24170f" strokeWidth="2" />
      <rect x="26" y="10" width="14" height="16" rx="4" fill="#ffd447" stroke="#24170f" strokeWidth="3" />
      <rect x="30" y="4" width="6" height="8" rx="2" fill="#24170f" />
    </svg>
  );
}
