import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8",
);

describe("dashboard slide menu interaction contract", () => {
  it("exposes an accessible menu trigger and dialog relationship", () => {
    expect(dashboardSource).toContain('id="dashboard-settings-menu"');
    expect(dashboardSource).toContain('aria-controls="dashboard-settings-menu"');
    expect(dashboardSource).toContain("aria-expanded={menuOpen}");
    expect(dashboardSource).toContain("onClick={() => setMenuOpen(true)}");
  });

  it("supports closing by backdrop and Escape while locking body scroll", () => {
    expect(dashboardSource).toContain('if (event.key === "Escape") {');
    expect(dashboardSource).toContain("event.preventDefault();\n          setMenuOpen(false);\n          return;");
    expect(dashboardSource).toContain('document.body.style.overflow = "hidden"');
    expect(dashboardSource).toContain("onClick={() => setMenuOpen(false)}");
  });

  it("keeps existing controls connected through stable action targets", () => {
    expect(dashboardSource).toContain('document.getElementById("btn-export-pdf")?.click()');
    expect(dashboardSource).toContain('document.getElementById("btn-logout")?.click()');
    expect(dashboardSource).toContain("setDemoRunning(r => !r)");
    expect(dashboardSource).toContain('localStorage.setItem("semiguard_muted"');
  });

  it("declares header actions as non-submitting buttons", () => {
    expect(dashboardSource).toContain('type="button"\n            onClick={() => {');
    expect(dashboardSource).toContain('type="button"\n            onClick={() => setDemoRunning(r => !r)}');
    expect(dashboardSource).toContain('type="button"\n            id="btn-export-pdf"');
    expect(dashboardSource).toContain('type="button"\n            id="btn-logout"');
  });

  it("provides localized names and values for header range controls", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "알림 음량"');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${Math.round(volume * 100)}퍼센트`');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "데모 실행 간격"');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${demoSpeed}초`');
  });

  it("provides localized current values for range controls in the slide menu", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "경고음 볼륨"');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${Math.round(volume * 100)}퍼센트`');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "데모 간격"');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${demoSpeed}초`');
  });

  it("provides localized names and values for risk threshold range controls", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "정상 최대 위험도 점수"');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${thresholds.normal}점`');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "주의 최대 위험도 점수"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "경고 최대 위험도 점수"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? `${s.label} ${row.label} 임계값`');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `현재 ${row.val.toFixed(s.step < 1 ? 2 : 0)}`');
  });

  it("exposes risk threshold panels as accessible expandable regions", () => {
    expect(dashboardSource).toContain('aria-expanded={showThresholdPanel}');
    expect(dashboardSource).toContain('aria-controls="risk-threshold-panel"');
    expect(dashboardSource).toContain('id="risk-threshold-panel" role="region"');
    expect(dashboardSource).toContain('aria-expanded={showSensorPanel}');
    expect(dashboardSource).toContain('aria-controls="sensor-threshold-panel"');
    expect(dashboardSource).toContain('id="sensor-threshold-panel" role="region"');
  });

  it("declares risk threshold reset actions as non-submitting buttons", () => {
    expect(dashboardSource).toContain('type="button"\n                          onClick={() => {\n                            const def = { normal: 29, caution: 49, warning: 69 };');
    expect(dashboardSource).toContain('type="button"\n                          onClick={() => {\n                            const def = {\n                              currentCaution: 7.0');
  });

  it("declares simulator actions as non-submitting buttons", () => {
    expect(dashboardSource).toContain('<button type="button" onClick={handleInjectNormal}');
    expect(dashboardSource).toContain('<button type="button" onClick={handleInjectCaution}');
    expect(dashboardSource).toContain('<button type="button" onClick={handleInjectWarning}');
    expect(dashboardSource).toContain('<button type="button" onClick={handleInjectAnomaly}');
    expect(dashboardSource).toContain('<button type="button" onClick={handleResetCost}');
  });

  it("labels anomaly history date filters in every supported language", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "이상 이력 시작일"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "이상 이력 종료일"');
    expect(dashboardSource).toContain('<button type="button" onClick={() => { setDateStart(""); setDateEnd(""); setLogPage(1); }}');
  });

  it("exposes anomaly risk filters as selected toggle controls", () => {
    expect(dashboardSource).toContain('<button key={f} type="button"');
    expect(dashboardSource).toContain('aria-pressed={isActive}');
    expect(dashboardSource).toContain('`${labelMap[f]} 위험 단계 필터${isActive ? ", 선택됨" : ""}`');
  });

  it("declares dashboard tabs as non-submitting controls", () => {
    expect(dashboardSource).toContain('<button key={tab} type="button" id={`dashboard-tab-${tab}`} role="tab"');
  });

  it("exposes new anomaly record notices as keyboard-dismissible buttons", () => {
    expect(dashboardSource).toContain('{newLogCount > 0 && (\n            <button\n              type="button"');
    expect(dashboardSource).toContain('onClick={() => setNewLogCount(0)}');
    expect(dashboardSource).toContain('`새 이상 이력 ${newLogCount}건 알림 닫기`');
  });

  it("exposes anomaly pagination as an accessible current-page navigation", () => {
    expect(dashboardSource).toContain('role="navigation" aria-label={lang === "ko" ? "이상 이력 페이지 탐색"');
    expect(dashboardSource).toContain('aria-current={logPage === p ? "page" : undefined}');
    expect(dashboardSource).toContain('`${p}페이지${logPage === p ? ", 현재 페이지" : ""}`');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "이전 페이지"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "다음 페이지"');
  });

  it("declares monthly heatmap month navigation as non-submitting buttons", () => {
    expect(dashboardSource).toContain('<button type="button" aria-label={lang === "ko" ? "이전 달"');
    expect(dashboardSource).toContain('<button type="button" aria-label={lang === "ko" ? "다음 달"');
  });

  it("declares anomaly detail modal close control as a non-submitting button", () => {
    expect(dashboardSource).toContain('<button ref={selectedLogCloseRef} type="button" onClick={() => setSelectedLog(null)}');
  });

  it("exposes consultation and feedback pagination context to assistive technology", () => {
    expect(dashboardSource).toContain('role="navigation" aria-label={lang === "ko" ? "상담 기록 페이지 탐색"');
    expect(dashboardSource).toContain('`상담 기록 ${activeHistorySessionPage} / ${historySessionTotalPages} 페이지`');
    expect(dashboardSource).toContain('role="navigation" aria-label={lang === "ko" ? "피드백 이력 페이지 탐색"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "피드백 이력 이전 페이지"');
    expect(dashboardSource).toContain('`피드백 이력 ${feedbackHistoryPage} / ${feedbackHistoryTotalPages} 페이지`');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "피드백 이력 다음 페이지"');
  });

  it("exposes account linking for all supported social providers", () => {
    expect(dashboardSource).toContain("trpc.auth.socialLinks.useQuery()");
    expect(dashboardSource).toContain("startGoogleLink");
    expect(dashboardSource).toContain("startNaverLink");
    expect(dashboardSource).toContain("startKakaoLink");
    expect(dashboardSource).toContain("unlinkSocialMutation");
  });
});
