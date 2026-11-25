/**
 * #117: short confirmation right where something was saved. It disappears on its own; only a failed
 * save stays visible (see `SaveFailureBanner`), because then something is still unsaved.
 *
 * The target is the detail panel of an element (`component:<id>` etc.). Panels are rebuilt after a
 * save (their key contains the version), so the confirmation lives here and not in the panel.
 */
import { useSyncExternalStore } from "react";

export interface SavedFeedback {
  target: string;
  /** "saved": shown on the panel's save button. "notice": small message in the panel, e.g. after creating. */
  kind: "saved" | "notice";
  text: string;
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

/** Call only after the server confirmed the save. */
export function announceNotice(target: string, text: string): void {
  show({ target, kind: "notice", text });
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

/** The feedback for this target, or null. */
export function useSavedFeedback(target: string | null): SavedFeedback | null {
  const feedback = useSyncExternalStore(subscribe, currentSavedFeedback, currentSavedFeedback);
  return feedback && target !== null && feedback.target === target ? feedback : null;
}
