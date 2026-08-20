# 🚀 배포 가이드 — 클릭만으로 따라하기 (비개발자용)

컴퓨터에 아무것도 설치할 필요 없습니다. 전부 **인터넷 브라우저에서 클릭**으로 진행합니다.
약 15분 정도 걸리고, 끝나면 `https://○○○.up.railway.app` 같은 주소가 생겨서
폰이나 PC에서 바로 접속할 수 있습니다.

Railway(레일웨이)라는 해외 호스팅 서비스를 사용합니다.
처음엔 무료 체험 크레딧으로 시작하고, 이후 월 $5(약 7천원) 정도의 요금제면 충분합니다.

---

## 1단계. Railway 가입

1. 브라우저에서 **railway.com** 접속
2. **Login** → **Continue with GitHub** 클릭
   (GitHub 계정 = 지금 이 저장소가 있는 계정으로 로그인)

## 2단계. 프로젝트 만들기

1. **New Project** 버튼 클릭
2. **Deploy from GitHub repo** 선택
3. 처음이라면 "Configure GitHub App" 화면이 나옵니다 → 본인 계정 선택 →
   **claude-automation** 저장소에 접근 허용 → 저장
4. 목록에서 **yulcoori/claude-automation** 클릭
5. 배포가 시작되기 전에 화면에서 서비스(카드)를 클릭 → **Settings** 탭 →
   **Branch** 를 `claude/pilates-member-management-app-f22m5p` 로 변경
   (PR을 main에 합쳤다면 `main` 그대로 두면 됩니다)

## 3단계. 저장 공간(볼륨) 붙이기 — 사진·데이터가 지워지지 않게

1. 서비스 카드에서 **마우스 오른쪽 클릭** (또는 Settings 안의 Volumes 메뉴)
2. **Attach Volume** 클릭
3. **Mount path** 에 정확히 다음을 입력: `/data`
4. 저장

## 4단계. 환경 변수 넣기

서비스 카드 클릭 → **Variables** 탭 → **Raw Editor** 버튼을 누르고
아래 내용을 통째로 붙여넣은 뒤 저장하세요:

```
DATABASE_URL=file:/data/app.db
UPLOAD_DIR=/data/uploads
NEXTAUTH_SECRET=여기를-아무도-모르는-긴-문장으로-바꿔주세요-예-momo2026pilates!secret
NEXT_PUBLIC_APP_NAME=모모필라테스
ADMIN_PHONE=01000000000
ADMIN_PASSWORD=admin1234!
ADMIN_NAME=원장님
```

- `NEXTAUTH_SECRET`: 비밀 열쇠입니다. 남이 못 맞출 아무 긴 문구로 바꿔주세요.
- `ADMIN_PHONE` / `ADMIN_PASSWORD`: 원장님이 로그인할 관리자 계정입니다. 원하는 값으로 바꾸세요.

## 5단계. 주소 만들기

1. **Settings** 탭 → **Networking** 항목 → **Generate Domain** 클릭
2. `○○○.up.railway.app` 같은 주소가 생깁니다 — 이게 우리 앱 주소!
3. 다시 **Variables** 탭으로 가서 변수 하나를 추가하세요:
   ```
   NEXTAUTH_URL=https://방금생긴주소
   ```
   (예: `NEXTAUTH_URL=https://claude-automation-production.up.railway.app`)
4. 저장하면 자동으로 다시 배포됩니다 (1~3분 소요)

## 6단계. 접속해서 테스트!

1. 5단계에서 만든 주소로 접속
2. 4단계에서 정한 **관리자 전화번호/비밀번호**로 로그인
3. 추천 테스트 순서:
   - ① 강사 등록 → ② 회원 등록(담당 강사 지정) → ③ 공지 작성
   - ④ 회원 상세에서: 수업 완료 +1 / 비포&애프터 업로드 / 10회차 차트 작성(체형 그림 마킹!)
   - ⑤ 방금 만든 회원 계정으로 로그아웃 → 로그인해서 회원 눈에 어떻게 보이는지 확인
4. 폰에서 접속한 뒤 "홈 화면에 추가"를 하면 앱처럼 설치됩니다
   - 아이폰: Safari에서 접속 → 공유 버튼(⬆️) → **홈 화면에 추가**
   - 안드로이드: Chrome에서 접속 → 메뉴(⋮) → **앱 설치**

---

## 문제가 생기면

- 화면이 안 뜨면: Railway에서 서비스 카드 → **Deployments** 탭 → 최근 배포의 **View Logs**
  내용을 복사해서 Claude에게 붙여넣어 주세요. 바로 원인을 찾아드립니다.
- 3~5단계 설정을 바꾸면 자동으로 재배포됩니다. 1~3분 기다렸다가 새로고침하세요.

## 다음 단계 (앱이 잘 뜨는 걸 확인한 후)

1. **카카오 로그인 연결**: developers.kakao.com에서 앱 키 발급 → Railway Variables에
   `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` 추가 (자세한 방법은 README 참고)
2. **알림톡 연결**: 카카오 비즈니스 채널이 이미 있으므로, solapi.com 가입 → 채널 연동 →
   템플릿 승인 → Variables에 `SOLAPI_API_KEY` 등 추가 (README '카카오 알림톡 설정' 참고)
3. **예쁜 주소 연결** (선택): `momopilates.com` 같은 도메인을 구입하면 Railway
   Settings → Networking → Custom Domain에서 연결할 수 있습니다.
