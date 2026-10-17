/** Move both the viewport and keyboard position without changing practice data. */
export function focusPracticeSection(target: Pick<HTMLElement, "focus" | "scrollIntoView"> | null) {
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "start", behavior: "auto" });
}
