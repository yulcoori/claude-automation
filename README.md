# 모모필라테스 회원 케어 앱 🧘

1:1 / 2:1 프라이빗 필라테스 센터를 위한 **회원 사후관리 웹앱(PWA)** 입니다.
회원님과 강사님이 모바일·PC 어디서든 함께 보는 소통 공간입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 📋 월말차트 | 실제 사용 중인 **모모필라테스 체형 분석 차트** 양식 그대로 디지털화 (10/20/30회차). 통증척도(VAS), 움직임 평가, **체형 그림 마킹**(정면/측면/후면 그림을 눌러 통증·긴장·개선 표시), 체형 평가, 단기/중기/장기 운동 계획. 기존 종이/시트 차트는 PDF·사진 첨부도 가능 |
| 🔔 알림 | 새 공지·댓글·비포애프터·차트가 올라오면 받는 사람에게 알림. 10/20/30회차 도달 시 강사에게 차트 작성 안내, 상단바 종 아이콘에 안 읽은 개수 표시 |
| 💬 알림톡 | 30회차(전체 회차) 완료 시 회원에게 카카오 알림톡 자동 발송 (Solapi 연동, 선택 설정) |
| ⚙️ 내 정보 | 본인 비밀번호 변경, 관리자는 회원/강사 비밀번호 재설정 가능 |
| 📸 비포&애프터 | 회차별 전후 사진/영상을 나란히 비교 업로드 (30회차까지) |
| 🎬 사진·영상 | 수업 사진/영상 피드 업로드 (여러 개 한 번에, 최대 200MB) |
| 💬 소통 | 모든 게시물·차트에 회원-강사 댓글 |
| 🗓 수업 기록 | 강사가 수업 완료 시 +1 기록, 진행률 바(N/30회) 자동 표시 |
| 🔔 승인 관리 | 카카오로 가입한 회원을 관리자가 확인 후 역할 지정·기존 계정 연결 |
| 📱 PWA | 홈 화면에 추가하면 앱처럼 사용 (앱스토어 심사 불필요) |

## 역할

- **관리자(원장님)**: 회원/강사 등록, 담당 강사 배정, 카카오 가입 승인, 전체 열람
- **강사**: 담당 회원의 차트 작성, 사진/영상 업로드, 수업 기록, 댓글
- **회원**: 본인 기록 열람, 댓글 (본인 페이지만 접근 가능)

## 시작하기 (로컬)

```bash
npm install
cp .env.example .env        # NEXTAUTH_SECRET 등 수정
npx prisma db push          # DB 생성
npm run db:seed             # 관리자 계정 생성
npm run dev                 # http://localhost:3000
```

최초 관리자 계정: 전화번호 `01000000000` / 비밀번호 `admin1234!`
(`.env`의 `ADMIN_PHONE`, `ADMIN_PASSWORD`로 변경 가능. **운영 전 반드시 변경하세요.**)

## 카카오 로그인 설정

1. [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 애플리케이션 추가
2. **앱 설정 > 플랫폼**: Web 플랫폼 등록, 사이트 도메인 입력
3. **제품 설정 > 카카오 로그인**: 활성화 ON, Redirect URI 등록:
   `https://내도메인/api/auth/callback/kakao`
4. **앱 키**의 REST API 키 → `.env`의 `KAKAO_CLIENT_ID`
5. **카카오 로그인 > 보안**에서 Client Secret 생성 → `KAKAO_CLIENT_SECRET`

> 카카오 키를 설정하지 않아도 전화번호+비밀번호 로그인으로 모든 기능을 사용할 수 있습니다.
> 카카오로 처음 로그인한 사용자는 "승인 대기" 상태가 되고, 관리자 대시보드에서
> 신규 회원 승인 / 강사 승인 / 기존 계정과 연결 중 선택하면 됩니다.

## 카카오 알림톡 설정 (선택)

30회차 완료 시 회원에게 카톡이 자동 발송됩니다. 설정하지 않아도 앱 내 알림은 동작합니다.

1. [카카오 비즈니스](https://business.kakao.com)에서 **비즈니스 채널** 개설 (무료)
2. [Solapi](https://solapi.com) 가입 → 카카오 채널 연동 → 발신번호 등록
3. 알림톡 **템플릿 등록 후 승인** 받기 (1~2일 소요). 변수 `#{이름}`, `#{회차}` 사용 가능
   - 예: `#{이름}님, #{회차}회차 수업을 모두 완료하셨습니다! 🎉 체형 분석 차트를 앱에서 확인해 주세요.`
4. `.env`에 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `ALIMTALK_PF_ID`, `ALIMTALK_SENDER_PHONE`, `ALIMTALK_TEMPLATE_COMPLETE` 입력

발송 비용은 건당 약 7~9원이며, 알림톡 실패 시 SMS로 대체 발송됩니다.

## 운영 배포

사진·영상 파일과 SQLite DB가 **서버 디스크에 저장**되므로, 파일이 유지되는 서버가 필요합니다.

- ✅ 추천: 디스크(볼륨)를 붙일 수 있는 곳 — Railway, Fly.io, 국내 VPS(가비아/카페24/iwinv), 홈서버
- ⚠️ Vercel/Netlify 같은 서버리스는 업로드 파일이 사라지므로 그대로는 부적합

**방법 A — Docker (추천, 서버에 Docker만 있으면 됨):**

```bash
cp .env.example .env   # NEXTAUTH_SECRET, NEXTAUTH_URL 등 수정
docker compose up -d --build
```

DB와 업로드 파일은 `./data` 폴더에 저장되어 컨테이너를 재시작해도 유지됩니다.
백업은 `data/` 폴더 하나만 복사하면 됩니다.

**방법 B — Node 직접 실행:**

```bash
npm install && npx prisma db push && npm run db:seed
npm run build
npm start   # 3000번 포트
```

`.env`에서 `NEXTAUTH_URL`을 실제 도메인으로, `NEXTAUTH_SECRET`을 새 랜덤 값으로 설정하세요
(`openssl rand -base64 32`). 업로드 폴더 위치는 `UPLOAD_DIR`로 바꿀 수 있습니다.

**도메인 연결**: 도메인 구입(가비아 등) 후 서버 IP로 A 레코드를 연결하고, Caddy나 nginx로
HTTPS를 붙이면 됩니다. Caddy 예시 (자동 HTTPS):

```
mycenter.com {
    reverse_proxy localhost:3000
}
```

## 차트 양식 수정

차트 항목(통증 부위, 움직임 평가 동작, 계획 단계 등)은
`src/lib/chartTemplate.ts` 한 파일에 모여 있습니다. 이 파일만 수정하면 양식이 바뀝니다.

## 기술 스택

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma + SQLite · NextAuth(카카오/전화번호) · PWA
