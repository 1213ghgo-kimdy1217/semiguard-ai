import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatBoxSource = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("common AI chat IME composition contract", () => {
  it("does not send a message while Enter is committing an IME composition", () => {
    expect(aiChatBoxSource).toContain('if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing)');
    expect(aiChatBoxSource).toContain("handleSubmit(e);");
  });
});
