// 모모필라테스 로고 마크
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 190" className={className} aria-hidden>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M112 92
             C 96 122, 70 148, 46 142
             C 24 136, 22 108, 44 98
             C 70 86, 98 108, 110 138
             C 118 158, 126 166, 136 160
             C 150 152, 152 80, 163 48
             C 172 24, 191 18, 203 38
             C 217 61, 224 114, 240 120
             C 258 126, 278 82, 292 44"
        />
      </g>
      <circle cx="283" cy="24" r="18" fill="currentColor" />
    </svg>
  );
}

// 원형 로고 (마크 + MOMO PILATES) — 로그인/가입 화면용
export function LogoBadge({
  size = 128,
  tagline = true,
}: {
  size?: number;
  tagline?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-full bg-brand-600 text-brand-50 shadow-lg"
      style={{ width: size, height: size }}
      aria-label="MOMO PILATES"
    >
      <LogoMark className="w-[64%]" />
      <div
        className="font-serif font-bold leading-none"
        style={{
          fontSize: size * 0.148,
          letterSpacing: size * 0.026,
          textIndent: size * 0.026,
          marginTop: size * 0.035,
        }}
      >
        MOMO
      </div>
      <div
        className="font-serif leading-none"
        style={{
          fontSize: size * 0.062,
          letterSpacing: size * 0.024,
          textIndent: size * 0.024,
          marginTop: size * 0.027,
        }}
      >
        PILATES
      </div>
      {tagline && (
        <div
          className="font-serif leading-none opacity-90"
          style={{
            fontSize: size * 0.031,
            letterSpacing: size * 0.0095,
            textIndent: size * 0.0095,
            marginTop: size * 0.024,
          }}
        >
          MOVEMENT · PRESCRIPTION
        </div>
      )}
    </div>
  );
}

// 상단바용 작은 원형 로고 (마크만)
export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-brand-600 text-brand-50 ${className}`}
    >
      <LogoMark className="w-[74%]" />
    </span>
  );
}
