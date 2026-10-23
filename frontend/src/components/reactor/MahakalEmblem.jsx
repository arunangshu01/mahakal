// Original line-art emblem of Mahakal: trishul, crescent moon, damaru,
// tripundra (three ash lines) and the vertical third eye.
export default function MahakalEmblem() {
  return (
    <svg className="emblem" viewBox="0 0 200 200" aria-label="Mahakal emblem">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset=".55" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff7a18" />
        </linearGradient>
        <radialGradient id="eyeGlow">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#glow)" fill="url(#gold)" stroke="url(#gold)">
        <path className="moon" d="M142 22a20 20 0 1 0 22 26 16 16 0 1 1-22-26z" stroke="none" />

        <g className="trishul" stroke="none">
          <path d="M100 10l9 26-5 34h-8l-5-34z" />
          <path d="M60 26c-4 22 4 40 30 46l2-7c-18-5-25-18-22-36z" />
          <path d="M140 26c4 22-4 40-30 46l-2-7c18-5 25-18 22-36z" />
          <rect x="78" y="70" width="44" height="7" rx="3" />
          <rect x="97" y="138" width="6" height="56" rx="2" />
        </g>

        <g className="damaru" stroke="none">
          <path d="M84 150h32l-16 13z" />
          <path d="M84 176h32l-16-13z" />
          <rect x="83" y="147" width="34" height="3" rx="1.5" />
          <rect x="83" y="176" width="34" height="3" rx="1.5" />
        </g>

        <g className="tripundra" fill="none" strokeWidth="4" strokeLinecap="round">
          <path d="M36 98q24-6 50-2M114 96q26-4 50 2" />
          <path d="M32 110q26-6 54-2M114 108q28-4 54 2" />
          <path d="M36 122q24-6 50-2M114 120q26-4 50 2" />
        </g>
      </g>

      <g className="third-eye">
        <circle cx="100" cy="110" r="26" fill="url(#eyeGlow)" className="eye-aura" />
        <path d="M100 84q18 26 0 52q-18-26 0-52z" fill="#1a0800" stroke="url(#gold)" strokeWidth="3" />
        <circle cx="100" cy="110" r="7" fill="var(--accent)" className="iris" />
        <circle cx="100" cy="110" r="2.5" fill="#fff" />
      </g>
    </svg>
  )
}
