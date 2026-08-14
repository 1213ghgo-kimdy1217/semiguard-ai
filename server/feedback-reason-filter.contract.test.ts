import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback reason filter contract", () => {
  it("filters negative feedback by the persisted reason code without affecting other filters", () => {
    expect(dashboardSource).toContain('const [feedbackReasonFilter, setFeedbackReasonFilter] = useState<"all" | "inaccurate" | "insufficient" | "irrelevant" | "other">("all")');
    expect(dashboardSource).toContain('item.feedbackType === "dislike" && item.reasonCode === feedbackReasonFilter');
    expect(dashboardSource).toContain('return matchesType && matchesReason && matchesDate');
    expect(dashboardSource).toContain('feedbackHistoryFilter, feedbackReasonFilter, feedbackHistorySearch');
  });

  it("keeps the reason filter visible in localized controls and CSV filenames", () => {
    expect(dashboardSource).toContain('ja: "理由すべて"');
    expect(dashboardSource).toContain('ja: "正確性"');
    expect(dashboardSource).toContain('const reasonName = feedbackReasonFilter === "all"');
    expect(dashboardSource).toContain('anchor.download = `${filenamePrefix}_${filterName}${reasonName}_${new Date().toISOString().slice(0, 10)}.csv`;');
  });
});
