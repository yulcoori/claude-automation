import crypto from "crypto";

// ============================================================
// 카카오 알림톡 발송 (Solapi 연동)
//
// 사용 준비 (README '카카오 알림톡 설정' 참고):
//   1. 카카오 비즈니스 채널 개설 (business.kakao.com)
//   2. Solapi(solapi.com) 가입 후 카카오 채널 연동
//   3. 알림톡 템플릿 등록 및 승인 (변수: #{이름}, #{회차})
//   4. .env 에 아래 값 설정
//      SOLAPI_API_KEY / SOLAPI_API_SECRET
//      ALIMTALK_PF_ID (연동된 카카오채널 ID)
//      ALIMTALK_SENDER_PHONE (등록된 발신번호)
//      ALIMTALK_TEMPLATE_COMPLETE (30회차 완료 템플릿 ID)
//
// 환경변수가 없으면 발송하지 않고 로그만 남깁니다(앱은 정상 동작).
// ============================================================

function config() {
  const {
    SOLAPI_API_KEY,
    SOLAPI_API_SECRET,
    ALIMTALK_PF_ID,
    ALIMTALK_SENDER_PHONE,
  } = process.env;
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !ALIMTALK_PF_ID || !ALIMTALK_SENDER_PHONE) {
    return null;
  }
  return {
    apiKey: SOLAPI_API_KEY,
    apiSecret: SOLAPI_API_SECRET,
    pfId: ALIMTALK_PF_ID,
    from: ALIMTALK_SENDER_PHONE.replace(/\D/g, ""),
  };
}

export async function sendAlimtalk(
  to: string | null,
  templateId: string | undefined,
  variables: Record<string, string>
): Promise<{ sent: boolean; reason?: string }> {
  const cfg = config();
  if (!cfg || !templateId || !to) {
    console.log(
      `[알림톡 미발송${cfg ? "" : " - 설정 없음"}] to=${to} template=${templateId}`,
      variables
    );
    return { sent: false, reason: cfg ? "no-template-or-phone" : "not-configured" };
  }

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", cfg.apiSecret)
    .update(date + salt)
    .digest("hex");

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${cfg.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/\D/g, ""),
          from: cfg.from,
          kakaoOptions: {
            pfId: cfg.pfId,
            templateId,
            variables,
            disableSms: false, // 알림톡 실패 시 SMS 대체 발송
          },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[알림톡 발송 실패] ${res.status}: ${text}`);
      return { sent: false, reason: `http-${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[알림톡 발송 오류]", e);
    return { sent: false, reason: "network-error" };
  }
}

// 30회차(전체 회차) 완료 시 회원에게 발송
export async function sendCompletionAlimtalk(phone: string | null, name: string, count: number) {
  return sendAlimtalk(phone, process.env.ALIMTALK_TEMPLATE_COMPLETE, {
    "#{이름}": name,
    "#{회차}": String(count),
  });
}
