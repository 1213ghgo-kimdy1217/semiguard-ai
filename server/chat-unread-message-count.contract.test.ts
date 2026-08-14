import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat unread-message count contract", () => {
  it("counts new messages only while the reader is away from the latest position", () => {
    expect(dashboardSource).toContain("const [unreadChatMessageCount, setUnreadChatMessageCount] = useState(0);");
    expect(dashboardSource).toContain("if (addedMessageCount > 0 && !isChatNearBottomRef.current)");
    expect(dashboardSource).toContain("setUnreadChatMessageCount(count => count + addedMessageCount);");
  });

  it("clears the unread count on return to the latest message and provides localized labels", () => {
    expect(dashboardSource).toContain("if (isNearBottom) setUnreadChatMessageCount(0);");
    expect(dashboardSource).toContain("새 답변 ${unreadChatMessageCount}");
    expect(dashboardSource).toContain("新着 ${unreadChatMessageCount}");
    expect(dashboardSource).toContain("New ${unreadChatMessageCount}");
  });
});
