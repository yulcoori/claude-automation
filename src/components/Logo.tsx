// 모모필라테스 로고 마크
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 190" className={className} aria-hidden>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M110 120 C 74 152, 36 146, 38 112 C 40 80, 90 74, 106 108
             C 120 138, 124 156, 138 156 C 155 156, 157 92, 168 62
             C 177 36, 193 28, 208 44 C 226 63, 236 104, 252 112
             C 268 120, 284 86, 296 52"
        />
      </g>
      <circle cx="286" cy="30" r="20" fill="currentColor" />
    </svg>
  );
}

// 원형 로고 배지 (마크 + 이름) — 로그인/가입 화면용
export function LogoBadge({ size = 112 }: { size?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-full bg-brand-600 text-brand-50 shadow-lg"
      style={{ width: size, height: size }}
      aria-label="모모필라테스"
    >
      <LogoMark className="w-[58%]" />
      <div
        className="font-serif font-bold leading-none tracking-[0.18em]"
        style={{ fontSize: size * 0.155, marginTop: size * 0.045, textIndent: "0.18em" }}
      >
        MOMO
      </div>
      <div
        className="font-serif leading-none tracking-[0.24em] opacity-95"
        style={{ fontSize: size * 0.068, marginTop: size * 0.03, textIndent: "0.24em" }}
      >
        PILATES
      </div>
    </div>
  );
}

// 상단바용 작은 아이콘 (마크만)
export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-xl bg-brand-600 text-brand-50 ${className}`}
    >
      <LogoMark className="w-[72%]" />
    </span>
  );
}
