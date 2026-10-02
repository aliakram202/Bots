import { GENERALS_BY_ID } from '../../game/generals/definitions';
import { PORTRAIT_OVERRIDES } from '../portraits';

const KCOLOR: Record<string, [string, string]> = {
  wei: ['#2d4568', '#0e1624'],
  shu: ['#6b231f', '#1f0b0a'],
  wu: ['#22533c', '#0a1a12'],
  qun: ['#5a4c33', '#1a160e'],
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Original generated ink-wash portrait: kingdom wash, brush calligraphy of the name, distant hills. */
export function Portrait({ general, w, h, dead }: { general: string | null; w: number | string; h: number | string; dead?: boolean }) {
  if (!general) {
    return (
      <div className="portrait" style={{ width: w, height: h }}>
        <svg viewBox="0 0 120 150">
          <rect width="120" height="150" fill="#16191f" />
          <text x="60" y="88" textAnchor="middle" fontSize="44" fill="#3a3f48" fontFamily="'Ma Shan Zheng', serif">?</text>
        </svg>
      </div>
    );
  }
  const g = GENERALS_BY_ID[general];
  const override = PORTRAIT_OVERRIDES[general];
  if (override) {
    return (
      <div className="portrait" style={{ width: w, height: h }}>
        <img src={override} alt={g.en} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dead ? 'grayscale(1)' : undefined }} />
      </div>
    );
  }
  const [c1, c2] = KCOLOR[g.kingdom];
  const hv = hash(general);
  const id = `p-${general}`;
  const chars = [...g.zh];
  const hill = 110 + (hv % 14);
  return (
    <div className="portrait" style={{ width: w, height: h }} aria-label={`${g.en} portrait`}>
      <svg viewBox="0 0 120 150" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`${id}-bg`} cx={`${30 + (hv % 40)}%`} cy="28%" r="90%">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </radialGradient>
          <filter id={`${id}-ink`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed={hv % 97} />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
        </defs>
        <rect width="120" height="150" fill={`url(#${id}-bg)`} />
        <circle cx={60 + ((hv >> 3) % 20) - 10} cy="58" r="40" fill="rgba(240,226,190,0.10)" filter={`url(#${id}-ink)`} />
        <path d={`M0 ${hill} Q 25 ${hill - 18} 45 ${hill - 4} T 85 ${hill - 10} T 120 ${hill - 2} V150 H0Z`} fill="rgba(0,0,0,0.35)" />
        <path d={`M0 ${hill + 14} Q 30 ${hill} 60 ${hill + 10} T 120 ${hill + 6} V150 H0Z`} fill="rgba(0,0,0,0.45)" />
        {chars.length <= 2 ? (
          chars.map((ch, i) => (
            <text key={i} x="60" y={chars.length === 1 ? 92 : 66 + i * 46} textAnchor="middle" fontSize={chars.length === 1 ? 70 : 46}
              fill="rgba(245,234,210,0.92)" fontFamily="'Ma Shan Zheng', 'Noto Serif SC', serif" filter={`url(#${id}-ink)`}>{ch}</text>
          ))
        ) : (
          chars.map((ch, i) => (
            <text key={i} x="60" y={44 + i * 36} textAnchor="middle" fontSize="36" fill="rgba(245,234,210,0.92)"
              fontFamily="'Ma Shan Zheng', 'Noto Serif SC', serif" filter={`url(#${id}-ink)`}>{ch}</text>
          ))
        )}
        <rect x="6" y="6" width="108" height="138" rx="6" fill="none" stroke="rgba(232,211,161,0.35)" strokeWidth="1" />
        {dead && <rect width="120" height="150" fill="rgba(0,0,0,0.55)" />}
      </svg>
    </div>
  );
}
