// ============================================================
// 모모필라테스 로고
//
// ▶ 실제 로고 이미지로 교체하려면:
//   1. 로고 파일을 public/brand/logo.png (또는 logo.svg) 로 저장
//   2. 아래 LOGO_SRC 를 "/brand/logo.png" 로 바꾸면 앱 전체에 적용됩니다.
//   (null 이면 아래 워드마크(MOMO PILATES 글자)가 표시됩니다)
// ============================================================
const LOGO_SRC: string | null = null;

// 원형 로고 (로그인/가입 화면용)
export function LogoBadge({
  size = 128,
  tagline = true,
}: {
  size?: number;
  tagline?: boolean;
}) {
  if (LOGO_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt="MOMO PILATES"
        className="rounded-full object-contain shadow-lg"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full bg-brand-600 text-brand-50 shadow-lg"
      style={{ width: size, height: size }}
      aria-label="MOMO PILATES"
    >
      <div
        className="font-serif font-bold leading-none"
        style={{
          fontSize: size * 0.2,
          letterSpacing: size * 0.035,
          textIndent: size * 0.035,
        }}
      >
        MOMO
      </div>
      <div
        className="font-serif leading-none"
        style={{
          fontSize: size * 0.085,
          letterSpacing: size * 0.033,
          textIndent: size * 0.033,
          marginTop: size * 0.055,
        }}
      >
        PILATES
      </div>
      {tagline && (
        <div
          className="font-serif leading-none opacity-90"
          style={{
            fontSize: size * 0.036,
            letterSpacing: size * 0.011,
            textIndent: size * 0.011,
            marginTop: size * 0.045,
          }}
        >
          MOVEMENT · PRESCRIPTION
        </div>
      )}
    </div>
  );
}

// 상단바용 작은 원형 로고
export function LogoIcon({ className = "" }: { className?: string }) {
  if (LOGO_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt="MOMO PILATES"
        className={`rounded-full object-contain ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-brand-600 font-serif font-bold text-brand-50 ${className}`}
      style={{ fontSize: "0.62rem", letterSpacing: "0.02em" }}
      aria-label="MOMO PILATES"
    >
      MP
    </span>
  );
}
