// ============================================================
// 모모필라테스 체형 분석 차트 양식 정의
// 실제 사용 중인 차트(구글시트) 양식을 그대로 옮긴 것입니다.
// 항목을 바꾸고 싶으면 이 파일만 수정하면 됩니다.
// ============================================================

// 통증척도 부위 (통증양상 + VAS 1회/현재)
export const PAIN_AREAS = ["목", "어깨", "허리", "골반", "기타"] as const;

// 움직임 평가 항목 (부위 그룹 + 동작명, 1회~30회 평가)
export const MOVEMENT_ITEMS: { group: string; name: string; note?: string }[] = [
  { group: "복부", name: "Roll down & Roll up", note: "*영상" },
  { group: "복부", name: "Plank / Side plank" },
  { group: "상체", name: "Swan" },
  { group: "상체", name: "YTWA / Thoracic rotation" },
  { group: "허리,골반", name: "Lateral flexion" },
  { group: "허리,골반", name: "Bridge *" },
  { group: "하체", name: "T-balance" },
  { group: "하체", name: "Horse back" },
  { group: "전신", name: "Thigh stretch" },
  { group: "전신", name: "Hanging" },
];

// 운동 계획 (단기/중기/장기, 각 6줄)
export const PLAN_PHASES = [
  { key: "planShort", label: "단기 (10회차)" },
  { key: "planMid", label: "중기 (20회차)" },
  { key: "planLong", label: "장기 (30회 이상)" },
] as const;

export const PLAN_LINE_COUNT = 6;
export const PLAN_GUIDE = "메인운동 or 스트레칭 + 타겟근육(목적) + 기구 or 소도구";

export const FITNESS_LEVELS = ["상", "중", "하"] as const;

export interface PainRow {
  area: string; // 부위 (기타 행은 직접 입력)
  pattern: string; // 통증양상
  vasStart: string; // VAS 1회
  vasNow: string; // VAS 현재
}

// 체형 그림 마킹 (정면/측면/후면 그림 위 표시)
export type BodyView = "front" | "side" | "back";
export type BodyMarkType = "pain" | "tight" | "improved";

export interface BodyMark {
  view: BodyView;
  x: number; // 그림 viewBox 좌표 (0~100)
  y: number; // 그림 viewBox 좌표 (0~220)
  type: BodyMarkType;
}

export const BODY_MARK_TYPES: { type: BodyMarkType; label: string; color: string }[] = [
  { type: "pain", label: "통증", color: "#dc2626" },
  { type: "tight", label: "긴장·단축", color: "#d97706" },
  { type: "improved", label: "개선", color: "#059669" },
];

export const BODY_VIEWS: { view: BodyView; label: string }[] = [
  { view: "front", label: "정면" },
  { view: "side", label: "측면" },
  { view: "back", label: "후면" },
];

// 움직임 평가에 첨부하는 사진/영상
export interface ChartMediaRef {
  path: string;
  kind: "IMAGE" | "VIDEO";
}

export interface MovementRow {
  group: string;
  name: string;
  equipment: string; // 어떤 기구에서 했는지
  start: string; // 1회 평가
  now: string; // 현재(30회) 평가
  startMedia: ChartMediaRef[]; // 1회 사진/영상
  nowMedia: ChartMediaRef[]; // 현재 사진/영상
}

export interface ChartContent {
  month: string; // ( 월)
  program: string; // 프로그램
  totalCount: string; // 전체횟수
  usedCount: string; // 사용횟수
  renewCount: string; // 리뉴횟수
  fitnessLevel: string; // 체력상태 상/중/하
  goal: string; // 회원님 운동목표
  achievement: string; // 방문 목적도 달성(%)
  pain: PainRow[];
  movement: MovementRow[];
  bodyMarks: BodyMark[]; // 체형 그림 마킹
  posture: string; // 체형 평가 내용 (정적평가)
  improvements: string; // 개선된 점과 앞으로 중점적으로 들어갈 운동
  planShort: string[];
  planMid: string[];
  planLong: string[];
}

export function emptyChartContent(): ChartContent {
  return {
    month: "",
    program: "",
    totalCount: "",
    usedCount: "",
    renewCount: "",
    fitnessLevel: "",
    goal: "",
    achievement: "",
    pain: PAIN_AREAS.map((area) => ({
      area: area === "기타" ? "" : area,
      pattern: "",
      vasStart: "",
      vasNow: "",
    })),
    movement: MOVEMENT_ITEMS.map((m) => ({
      group: m.group,
      name: m.name,
      equipment: "",
      start: "",
      now: "",
      startMedia: [],
      nowMedia: [],
    })),
    bodyMarks: [],
    posture: "",
    improvements: "",
    planShort: Array(PLAN_LINE_COUNT).fill(""),
    planMid: Array(PLAN_LINE_COUNT).fill(""),
    planLong: Array(PLAN_LINE_COUNT).fill(""),
  };
}

export function parseChartContent(json: string): ChartContent {
  const empty = emptyChartContent();
  try {
    const data = JSON.parse(json);
    return {
      ...empty,
      ...data,
      pain: Array.isArray(data.pain) && data.pain.length ? data.pain : empty.pain,
      movement:
        Array.isArray(data.movement) && data.movement.length
          ? data.movement.map((r: Partial<MovementRow>) => ({
              group: r.group ?? "",
              name: r.name ?? "",
              equipment: r.equipment ?? "",
              start: r.start ?? "",
              now: r.now ?? "",
              startMedia: Array.isArray(r.startMedia) ? r.startMedia : [],
              nowMedia: Array.isArray(r.nowMedia) ? r.nowMedia : [],
            }))
          : empty.movement,
      bodyMarks: Array.isArray(data.bodyMarks) ? data.bodyMarks : [],
      planShort: Array.isArray(data.planShort) ? padLines(data.planShort) : empty.planShort,
      planMid: Array.isArray(data.planMid) ? padLines(data.planMid) : empty.planMid,
      planLong: Array.isArray(data.planLong) ? padLines(data.planLong) : empty.planLong,
    };
  } catch {
    return empty;
  }
}

function padLines(lines: string[]): string[] {
  const out = lines.slice(0, PLAN_LINE_COUNT);
  while (out.length < PLAN_LINE_COUNT) out.push("");
  return out;
}
