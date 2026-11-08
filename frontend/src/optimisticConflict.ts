import { ApiError } from "./authApi";

export type ConflictResolution = "reload" | "overwrite";

/** Displays explicit actions while the caller keeps its local draft untouched. */
export function askConflictResolution(message: string): Promise<ConflictResolution> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "conflict-backdrop";
    backdrop.setAttribute("role", "presentation");
    const dialog = document.createElement("section");
    dialog.className = "conflict-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "conflict-title");
    dialog.innerHTML = `<h2 id="conflict-title">Bearbeitungskonflikt</h2><p></p><div class="conflict-actions"></div>`;
    dialog.querySelector("p")!.textContent = message;
    const actions = dialog.querySelector(".conflict-actions")!;
    const finish = (choice: ConflictResolution) => { backdrop.remove(); resolve(choice); };
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Neu laden";
    reload.addEventListener("click", () => finish("reload"));
    const overwrite = document.createElement("button");
    overwrite.type = "button";
    overwrite.className = "danger";
    overwrite.textContent = "Bewusst überschreiben";
    overwrite.addEventListener("click", () => finish("overwrite"));
    actions.append(reload, overwrite);
    backdrop.append(dialog);
    document.body.append(backdrop);
    reload.focus();
  });
}

export type OptimisticMutationResult<T> = { applied: true; value: T } | { applied: false };

/**
 * Retries only after an explicit overwrite choice and always against the server-provided
 * current version. A second intervening write therefore opens a new conflict instead of
 * bypassing the lock.
 */
export async function runOptimisticMutation<T>(
  initialVersion: number,
  attempt: (expectedVersion: number) => Promise<T>,
  reload: () => Promise<void>,
  choose: (message: string) => Promise<ConflictResolution> = askConflictResolution
): Promise<OptimisticMutationResult<T>> {
  let expectedVersion = initialVersion;
  for (;;) {
    try {
      return { applied: true, value: await attempt(expectedVersion) };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409 || error.body.code !== "OPTIMISTIC_LOCK_CONFLICT") throw error;
      const current = error.body.current as { version?: unknown } | undefined;
      if (!current || !Number.isSafeInteger(current.version) || Number(current.version) < 1) throw error;
      const choice = await choose(
        "Der Server enthält bereits eine neuere Version. Der aktuelle Entwurf bleibt erhalten. Neu laden verwirft ihn; bewusstes Überschreiben versucht ihn gegen den gerade gemeldeten Stand erneut."
      );
      if (choice === "reload") {
        await reload();
        return { applied: false };
      }
      expectedVersion = Number(current.version);
    }
  }
}
