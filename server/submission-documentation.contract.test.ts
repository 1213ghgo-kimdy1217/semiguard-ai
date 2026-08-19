import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const readProjectDocument = (filename: string) => readFileSync(resolve(projectRoot, filename), "utf8");

const readme = readProjectDocument("README.md");
const aiUsage = readProjectDocument("AI_USAGE.md");
const validationPlan = readProjectDocument("VALIDATION_PLAN.md");
const pitchStoryboard = readProjectDocument("PITCH_VIDEO_STORYBOARD.md");
const tenMinuteScript = readProjectDocument("PRESENTATION_10_MIN_SCRIPT.md");
const recordingChecklist = readProjectDocument("DEMO_RECORDING_CHECKLIST.md");
const mobileSocialLoginValidation = readProjectDocument("MOBILE_SOCIAL_LOGIN_VALIDATION.md");
const pilotLogValidationTemplate = readProjectDocument("PILOT_LOG_VALIDATION_TEMPLATE.md");
const itOtReadOnlyPilotChecklist = readProjectDocument("IT_OT_READ_ONLY_PILOT_CHECKLIST.md");
const fieldPilotReviewTemplate = readProjectDocument("FIELD_PILOT_REVIEW_TEMPLATE.md");
const userInterviewTemplate = readProjectDocument("USER_INTERVIEW_TEMPLATE.md");
const kpiMeasurementTemplate = readProjectDocument("KPI_MEASUREMENT_TEMPLATE.md");
const firstUserObservationTemplate = readProjectDocument("FIRST_USER_OBSERVATION_TEMPLATE.md");
const evidenceRegisterTemplate = readProjectDocument("EVIDENCE_REGISTER_TEMPLATE.md");
const externalAdvisorReviewTemplate = readProjectDocument("EXTERNAL_ADVISOR_REVIEW_TEMPLATE.md");

describe("submission documentation contract", () => {
  it("keeps all linked submission documents in the repository", () => {
    [
      "AI_USAGE.md",
      "VALIDATION_PLAN.md",
      "PITCH_VIDEO_STORYBOARD.md",
      "PRESENTATION_DEMO_SCRIPT.md",
      "PRESENTATION_10_MIN_SCRIPT.md",
      "DEMO_RECORDING_CHECKLIST.md",
      "MOBILE_SOCIAL_LOGIN_VALIDATION.md",
      "PILOT_LOG_VALIDATION_TEMPLATE.md",
      "IT_OT_READ_ONLY_PILOT_CHECKLIST.md",
      "FIELD_PILOT_REVIEW_TEMPLATE.md",
      "USER_INTERVIEW_TEMPLATE.md",
      "KPI_MEASUREMENT_TEMPLATE.md",
      "FIRST_USER_OBSERVATION_TEMPLATE.md",
      "EVIDENCE_REGISTER_TEMPLATE.md",
      "EXTERNAL_ADVISOR_REVIEW_TEMPLATE.md",
      "W1_TEAM_GOALS.md",
      "DEPENDENCY_SECURITY_REVIEW.md",
    ].forEach(filename => {
      expect(existsSync(resolve(projectRoot, filename))).toBe(true);
      expect(readme).toContain(`](${filename})`);
    });
  });

  it("keeps the runnable account, two-person team, and read-only scope visible", () => {
    expect(readme).toContain("TEST-2026-V1");
    expect(readme).toContain("김대영");
    expect(readme).toContain("김승현");
    expect(readme).not.toContain("김경서");
    expect(readme).toContain("읽기 전용 예지안전 보조 시스템");
    expect(readme).toContain("실제 장비 제어, 레시피 변경, PLC 명령 전송 기능은 제공하지 않습니다.");
  });

  it("keeps the implemented z-score method and unvalidated simulation boundary consistent", () => {
    expect(readme).toContain("z-score 기반 규칙형 위험 점수");
    expect(readme).toContain("Isolation Forest 라이브러리가 아니라");
    expect(aiUsage).toContain("시뮬레이션 데이터");
    expect(aiUsage).toContain("실제 팹에서 검증된 경제적 성과가 아닙니다.");
    expect(validationPlan).toContain("정확도·오탐·미탐·사전 경고 시간을 측정한 결과는 아직 없습니다.");
    expect(pitchStoryboard).toContain("실제 정확도·비용 절감·설비 제어 성과를 이미 달성한 것처럼 말하지 않습니다.");
  });

  it("keeps the ten-minute script timed, two-person, and transparent about validation status", () => {
    expect(tenMinuteScript).toContain("0:00–0:40");
    expect(tenMinuteScript).toContain("9:40–10:00");
    expect(tenMinuteScript).toContain("김대영");
    expect(tenMinuteScript).toContain("김승현");
    expect(tenMinuteScript).toContain("z-score 편차를 합산하는 규칙형 계산");
    expect(tenMinuteScript).toContain("실제 팹 데이터에서의 정확도는 아직 검증 전입니다.");
    expect(tenMinuteScript).toContain("설비를 자동으로 멈출 수 있나요?");
  });

  it("keeps the recording checklist centered on the public demo and transparent boundaries", () => {
    expect(recordingChecklist).toContain("https://semiguardai-jifnzsvd.manus.space/demo");
    expect(recordingChecklist).toContain("공개 `/demo`만으로");
    expect(recordingChecklist).toContain("자동 설비 제어, 실제 팹 정확도, 실제 비용 절감 성과");
    expect(recordingChecklist).toContain("실제 촬영·편집·제출은 팀이 직접 확인하고 수행해야 하며");
  });

  it("keeps mobile social-login validation on the published site without exposing credentials", () => {
    expect(mobileSocialLoginValidation).toContain("https://semiguardai-jifnzsvd.manus.space/login");
    expect(mobileSocialLoginValidation).toContain("신규 계정을 만드는 경로가 아닙니다");
    expect(mobileSocialLoginValidation).toContain("클라이언트 시크릿, 인증 코드, 액세스 토큰, 쿠키 값은");
    expect(mobileSocialLoginValidation).toContain("대시보드 진입 → 새로고침 후 유지 → 로그아웃 후 로그인 화면 복귀");
  });

  it("keeps the pilot log template empty, approval-gated, and read-only before real data is supplied", () => {
    expect(pilotLogValidationTemplate).toContain("현재는 데이터를 수령하거나 업로드하지 않았으며");
    expect(pilotLogValidationTemplate).toContain("승인한 과거 센서 로그의 읽기 전용 복제본");
    expect(pilotLogValidationTemplate).toContain("오탐과 미탐은 삭제하거나 예외로 숨기지 않습니다");
    expect(pilotLogValidationTemplate).toContain("설비 제어 기능을 추가하지 않습니다");
  });

  it("keeps the IT/OT checklist approval-gated and blocks equipment control paths", () => {
    expect(itOtReadOnlyPilotChecklist).toContain("SemiGuard AI는 설비·PLC·MES에 가동·정지·레시피 변경·알람 해제·쓰기 명령을 전송하지 않으며");
    expect(itOtReadOnlyPilotChecklist).toContain("제어 경로 차단");
    expect(itOtReadOnlyPilotChecklist).toContain("하나라도 미승인·미기입·정책 충돌이면 파일럿은 **보류**합니다");
    expect(itOtReadOnlyPilotChecklist).toContain("단일 장비");
  });

  it("keeps the field-pilot review template unexecuted, read-only, and honest about scope expansion", () => {
    expect(fieldPilotReviewTemplate).toContain("현재는 현장 파일럿을 진행하지 않았으며");
    expect(fieldPilotReviewTemplate).toContain("SemiGuard AI 화면은 읽기 전용 참고 자료이며");
    expect(fieldPilotReviewTemplate).toContain("오탐·미탐이 발견되면 결과를 좋게 보이게 하려고 기준값을 즉시 조정하지 않습니다");
    expect(fieldPilotReviewTemplate).toContain("자동 확대하지 않습니다");
  });

  it("keeps the user interview template consent-based, privacy-minimizing, and free of fabricated results", () => {
    expect(userInterviewTemplate).toContain("현재 인터뷰 결과, 참여자 수, 반복 문제는 **아직 기록하지 않습니다.**");
    expect(userInterviewTemplate).toContain("이름, 학번, 전화번호, 이메일, 소셜 계정");
    expect(userInterviewTemplate).toContain("미성년 참여자는 학교·보호자 정책에 맞는 사전 허용 범위");
    expect(userInterviewTemplate).toContain("최소 5명의 실제 참여자 기록이 쌓이기 전에는 빈도·비율·사용자 수를 주장하지 않습니다");
  });

  it("keeps the KPI template explicit about actual measurement, denominators, exclusions, and small samples", () => {
    expect(kpiMeasurementTemplate).toContain("현재 실제 사용자 측정은 시작 전이므로");
    expect(kpiMeasurementTemplate).toContain("같은 기간·같은 분모·같은 제외 기준");
    expect(kpiMeasurementTemplate).toContain("분모가 0이면 비율을 0%로 바꾸지 않고 `계산 불가`");
    expect(kpiMeasurementTemplate).toContain("작은 표본의 변화는 제품 효과의 확정 증거가 아닙니다");
  });

  it("keeps the first-user observation template privacy-minimizing and free of fabricated recruitment results", () => {
    expect(firstUserObservationTemplate).toContain("현재 모집 인원, 이탈률, 개선 효과는 **기록하지 않습니다.**");
    expect(firstUserObservationTemplate).toContain("이름, 학번, 연락처, 계정, 실제 설비명은 기록하지 않습니다");
    expect(firstUserObservationTemplate).toContain("개선은 한 번에 하나의 가설로 제한합니다");
    expect(firstUserObservationTemplate).toContain("실제 모집·관찰이 끝나기 전에는");
  });

  it("keeps the evidence register empty before collection and connects claims to reviewed evidence", () => {
    expect(evidenceRegisterTemplate).toContain("현재 실제 증거는 수집·등록하지 않았으며");
    expect(evidenceRegisterTemplate).toContain("개인 식별 정보·실제 설비 식별 정보·인증 정보는 등록부에 넣지 않음");
    expect(evidenceRegisterTemplate).toContain("대외 문장 하나마다 증거를 최소 하나 연결하고");
    expect(evidenceRegisterTemplate).toContain("실제 증거가 없거나 검토가 끝나지 않은 항목은 비워 두고");
  });

  it("keeps external-advisor records empty until an actual, consented review occurs", () => {
    expect(externalAdvisorReviewTemplate).toContain("외부 멘토·교사·현장 전문가의 실제 의견을 받은 뒤에만");
    expect(externalAdvisorReviewTemplate).toContain("자문을 받은 것처럼 쓰거나 자문 의견을 임의로 만들지 않습니다");
    expect(externalAdvisorReviewTemplate).toContain("개인 연락처·소속의 비공개 정보·설비 기밀은 적지 않습니다");
    expect(externalAdvisorReviewTemplate).toContain("준비 완료");
  });
});
