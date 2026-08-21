import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat latest-message control contract", () => {
  it("tracks whether the reader has scrolled away from the latest message", () => {
    expect(dashboardSource).toContain("const chatMessageListRef = useRef<HTMLDivElement>(null);");
    expect(dashboardSource).toContain("const [isChatAwayFromLatest, setIsChatAwayFromLatest] = useState(false);");
    expect(dashboardSource).toContain("element.scrollHeight - element.scrollTop - element.clientHeight < 56");
  });

  it("provides a localized jump-to-latest control and preserves automatic scrolling near the bottom", () => {
    expect(dashboardSource).toContain("if (!isChatOpen || !isChatNearBottomRef.current) return;");
    expect(dashboardSource).toContain("messageList.scrollTo({ top: messageList.scrollHeight, behavior: getKeyboardScrollBehavior() })");
    expect(dashboardSource).toContain("최신 메시지로 이동");
    expect(dashboardSource).toContain("最新メッセージへ移動");
    expect(dashboardSource).toContain("Jump to latest message");
  });
});
