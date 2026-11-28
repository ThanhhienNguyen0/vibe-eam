/**
 * #117: tracks every write to the repository so the UI can show whether changes are saved.
 *
 * - "saved" only after the server answered 2xx, i.e. after it persisted the change.
 * - A transient failure (no answer, timeout, rate limit, 5xx) is held: the caller keeps waiting,
 *   and the user can retry the identical request or discard it. On a successful retry the caller
 *   continues as if the first attempt had worked, so its own state stays consistent.
 * - A final answer (4xx: validation, conflict, permission) is passed on to the caller at once; it is
 *   shown as failed until the next write starts or the user closes the message.
 */
import { ApiError } from "./authApi";

export type SaveState = "saved" | "saving" | "failed";

export interface SaveFailure {
  message: string;
  /** True when the same request may succeed again (offered as "Erneut versuchen"). */
  retryable: boolean;
}

export interface SaveSnapshot {
  state: SaveState;
  /** Writes waiting for the server's answer. */
  pending: number;
  /** Failed writes that wait for "Erneut versuchen" or "Verwerfen". */
  unsaved: number;
  failure: SaveFailure | null;
}

export interface SaveTracker {
  track<T>(send: () => Promise<T>): Promise<T>;
  /** Sends every held write again, in the original order. */
  retry(): Promise<void>;
  /** Gives up the held writes; their callers receive the original error. Returns how many were discarded. */
  discard(): number;
  /** Closes the message of a final (non-retryable) failure. */
  dismiss(): void;
  /**
   * Forgets everything of the current session (logout, expired login). Held writes are discarded and
   * late failures of writes still in flight are not held, so nothing is ever re-sent with another login.
   */
  reset(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SaveSnapshot;
}

interface Write {
  send: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  /** Session the write belongs to; see `reset`. */
  session: number;
}

interface HeldWrite extends Write {
  error: unknown;
}

/** No answer, timeout, rate limit or server error: the identical request may work later. 4xx answers are final. */
export function isRetryableSaveError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408 || error.status === 429;
  // fetch() rejects with a TypeError when no response arrives (offline, server down, CORS).
  return error instanceof TypeError;
}

export function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.status >= 500 ? `Serverfehler (HTTP ${error.status}).` : error.message;
  if (error instanceof TypeError) return "Der Server ist nicht erreichbar.";
  return error instanceof Error && error.message ? error.message : "Unbekannter Fehler.";
}

export function createSaveTracker(): SaveTracker {
  let pending = 0;
  let held: HeldWrite[] = [];
  let rejection: string | null = null;
  let session = 0;
  let snapshot: SaveSnapshot = { state: "saved", pending: 0, unsaved: 0, failure: null };
  const listeners = new Set<() => void>();

  function publish() {
    const latest = held[held.length - 1];
    const failure: SaveFailure | null = latest
      ? { message: saveErrorMessage(latest.error), retryable: true }
      : rejection !== null ? { message: rejection, retryable: false } : null;
    const state: SaveState = held.length > 0 ? "failed" : pending > 0 ? "saving" : failure ? "failed" : "saved";
    snapshot = { state, pending, unsaved: held.length, failure };
    listeners.forEach((listener) => listener());
  }

  /** Expects the write to be counted in `pending` already. */
  async function settle(write: Write): Promise<void> {
    try {
      const value = await write.send();
      pending--;
      publish();
      write.resolve(value);
    } catch (error) {
      pending--;
      if (write.session !== session) {
        write.reject(error);
      } else if (isRetryableSaveError(error)) {
        held = [...held, { ...write, error }];
      } else {
        rejection = saveErrorMessage(error);
        write.reject(error);
      }
      publish();
    }
  }

  return {
    track<T>(send: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending++;
        rejection = null;
        publish();
        void settle({ send, resolve: resolve as (value: unknown) => void, reject, session });
      });
    },
    async retry() {
      const writes = held;
      if (writes.length === 0) return;
      held = [];
      pending += writes.length;
      rejection = null;
      publish();
      for (const write of writes) {
        if (write.session === session) {
          await settle(write);
          continue;
        }
        // Logged out while retrying: do not send the rest with the next login.
        pending--;
        publish();
        write.reject(write.error);
      }
    },
    discard() {
      const writes = held;
      if (writes.length === 0) return 0;
      held = [];
      publish();
      writes.forEach((write) => write.reject(write.error));
      return writes.length;
    },
    dismiss() {
      if (rejection === null) return;
      rejection = null;
      publish();
    },
    reset() {
      session++;
      const writes = held;
      held = [];
      rejection = null;
      publish();
      writes.forEach((write) => write.reject(write.error));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot
  };
}

/** The tracker used by `sidebarApi` for all repository writes. */
export const saveTracker = createSaveTracker();
