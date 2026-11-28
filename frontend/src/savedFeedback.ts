/**
 * #117: short confirmation right where something was saved. It disappears on its own; only a failed
 * save stays visible (see `SaveFailureBanner`), because then something is still unsaved.
 *
 * - "saved": a save in the detail panel, shown on its save button.
 * - "sidebar": creating or renaming in the sidebar, shown there (row and message), not in the panel.
 *
 * The target is the element (`component:<id>` etc.). Panels are rebuilt after a save (their key
 * contains the version), so the confirmation lives here and not in the panel.
 */
import { useSyncExternalStore } from "react";

export interface SavedFeedback {
  target: string;
  kind: "saved" | "sidebar";
  text: string;
  /** "danger": a permanent deletion, shown in red. */
  tone?: "danger";
  id: number;
}

export const SAVED_FEEDBACK_MS = 2500;

let current: SavedFeedback | null = null;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function show(feedback: Omit<SavedFeedback, "id">) {
  current = { ...feedback, id: ++sequence };
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    listeners.forEach((listener) => listener());
  }, SAVED_FEEDBACK_MS);
  listeners.forEach((listener) => listener());
}

export function feedbackTarget(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** Call only after the server confirmed the save. */
export function announceSaved(target: string): void {
  show({ target, kind: "saved", text: "Gespeichert" });
}

/** Call only after the server confirmed the save (or the deletion, with tone "danger"). */
export function announceInSidebar(target: string, text: string, tone?: "danger"): void {
  show({ target, kind: "sidebar", text, ...(tone ? { tone } : {}) });
}

export function clearSavedFeedback(): void {
  clearTimeout(timer);
  current = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function currentSavedFeedback(): SavedFeedback | null {
  return current;
}

function useCurrentFeedback(): SavedFeedback | null {
  return useSyncExternalStore(subscribe, currentSavedFeedback, currentSavedFeedback);
}

/** The feedback for this target, or null. */
export function useSavedFeedback(target: string | null): SavedFeedback | null {
  const feedback = useCurrentFeedback();
  return feedback && target !== null && feedback.target === target ? feedback : null;
}

/** The current confirmation of a sidebar action, or null. */
export function useSidebarFeedback(): SavedFeedback | null {
  const feedback = useCurrentFeedback();
  return feedback?.kind === "sidebar" ? feedback : null;
}
