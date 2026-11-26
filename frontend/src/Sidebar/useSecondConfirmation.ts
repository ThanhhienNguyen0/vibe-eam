import { useState } from "react";

/**
 * #113: Two-step confirmation for a value that is allowed but questionable, e.g. a placeholder name.
 * The first `confirm()` only records the confirmation and returns false, so the UI can ask once more;
 * the second `confirm()` for the same value returns true. Changing the value starts over.
 */
export function useSecondConfirmation(warning: string | null, value: string) {
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const key = value.trim();
  const awaiting = warning !== null && confirmedFor === key;
  return {
    /** The first confirmation was given; the next one saves. */
    awaiting,
    /** True when saving may go ahead now: nothing to confirm, or the second confirmation. */
    confirm(): boolean {
      if (warning === null || confirmedFor === key) return true;
      setConfirmedFor(key);
      return false;
    }
  };
}
