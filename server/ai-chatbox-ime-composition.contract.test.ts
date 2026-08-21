import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatBoxSource = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("common AI chat IME composition contract", () => {
  it("does not send a message while Enter is committing an IME composition", () => {
    expect(aiChatBoxSource).toContain('if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing)');
    expect(aiChatBoxSource).toContain("handleSubmit(e);");
  });

  it("keeps automatic scrolling immediate when reduced motion is requested", () => {
    expect(aiChatBoxSource).toContain('behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"');
  });

  it("offers a mobile send keyboard hint without changing the multiline Enter shortcut", () => {
    expect(aiChatBoxSource).toContain('enterKeyHint="send"');
    expect(aiChatBoxSource).toContain('!e.shiftKey && !e.nativeEvent.isComposing');
  });

  it("gives the icon-only send button an accessible name and busy state", () => {
    expect(aiChatBoxSource).toContain('aria-label={isLoading ? "AI is responding" : "Send message"}');
    expect(aiChatBoxSource).toContain('aria-busy={isLoading || undefined}');
  });

  it("announces the full AI response generation status instead of only exposing a spinner", () => {
    expect(aiChatBoxSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(aiChatBoxSource).toContain('<span className="sr-only">AI is generating a response</span>');
    expect(aiChatBoxSource).toContain('Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true"');
  });

  it("announces newly added conversation messages through a polite live log", () => {
    expect(aiChatBoxSource).toContain('role="log" aria-live="polite" aria-relevant="additions text" aria-label="AI conversation"');
  });

  it("keeps the chat input named after its placeholder even while the placeholder is visually hidden", () => {
    expect(aiChatBoxSource).toContain('aria-label={placeholder}');
  });

  it("provides sender context before each newly announced chat message", () => {
    expect(aiChatBoxSource).toContain('<span className="sr-only">{message.role === "assistant" ? "AI: " : "You: "}</span>');
  });
});
