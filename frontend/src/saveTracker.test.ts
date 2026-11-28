import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./authApi";
import { createSaveTracker, isRetryableSaveError, saveErrorMessage } from "./saveTracker";

/** A request whose answer the test decides. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const offline = () => new TypeError("Failed to fetch");

describe("save tracker (#117)", () => {
  it("starts as saved", () => {
    expect(createSaveTracker().getSnapshot()).toEqual({ state: "saved", pending: 0, unsaved: 0, failure: null });
  });

  it("shows saving while the server has not answered, and saved only after it confirmed", async () => {
    const tracker = createSaveTracker();
    const answer = deferred<string>();
    const result = tracker.track(() => answer.promise);
    expect(tracker.getSnapshot()).toMatchObject({ state: "saving", pending: 1 });

    answer.resolve("stored");
    await expect(result).resolves.toBe("stored");
    expect(tracker.getSnapshot()).toMatchObject({ state: "saved", pending: 0 });
  });

  it("stays saving until every parallel write is confirmed", async () => {
    const tracker = createSaveTracker();
    const first = deferred();
    const second = deferred();
    void tracker.track(() => first.promise);
    void tracker.track(() => second.promise);
    first.resolve("a");
    await flush();
    expect(tracker.getSnapshot()).toMatchObject({ state: "saving", pending: 1 });
    second.resolve("b");
    await flush();
    expect(tracker.getSnapshot().state).toBe("saved");
  });

  it("does not report a failed write as saved and keeps the caller waiting for a retry", async () => {
    const tracker = createSaveTracker();
    const send = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValueOnce("stored on retry");
    const settled = vi.fn();
    const result = tracker.track(send);
    void result.then(settled, settled);
    await flush();

    expect(tracker.getSnapshot()).toEqual({
      state: "failed",
      pending: 0,
      unsaved: 1,
      failure: { message: "Der Server ist nicht erreichbar.", retryable: true }
    });
    expect(settled).not.toHaveBeenCalled();

    await tracker.retry();
    await expect(result).resolves.toBe("stored on retry");
    expect(send).toHaveBeenCalledTimes(2);
    expect(tracker.getSnapshot().state).toBe("saved");
  });

  it("stays failed when the retry fails again", async () => {
    const tracker = createSaveTracker();
    const send = vi.fn().mockRejectedValue(new ApiError(503, "Service Unavailable"));
    void tracker.track(send);
    await flush();
    await tracker.retry();
    expect(tracker.getSnapshot()).toMatchObject({ state: "failed", unsaved: 1, failure: { message: "Serverfehler (HTTP 503).", retryable: true } });
  });

  it("retries held writes in their original order", async () => {
    const tracker = createSaveTracker();
    const order: string[] = [];
    let online = false;
    const write = (name: string) => async () => {
      if (!online) throw offline();
      order.push(name);
      return name;
    };
    const results = [tracker.track(write("first")), tracker.track(write("second"))];
    await flush();
    expect(tracker.getSnapshot()).toMatchObject({ state: "failed", unsaved: 2 });

    online = true;
    await tracker.retry();
    await expect(Promise.all(results)).resolves.toEqual(["first", "second"]);
    expect(order).toEqual(["first", "second"]);
  });

  it("keeps showing a held failure while other writes succeed", async () => {
    const tracker = createSaveTracker();
    void tracker.track(() => Promise.reject(offline()));
    await flush();
    await tracker.track(() => Promise.resolve("other change"));
    expect(tracker.getSnapshot()).toMatchObject({ state: "failed", unsaved: 1 });
  });

  it("gives the original error to the caller when the user discards", async () => {
    const tracker = createSaveTracker();
    const error = offline();
    const result = tracker.track(() => Promise.reject(error));
    await flush();

    expect(tracker.discard()).toBe(1);
    await expect(result).rejects.toBe(error);
    expect(tracker.getSnapshot().state).toBe("saved");
    expect(tracker.discard()).toBe(0);
  });

  it("passes a final rejection on at once and shows it until the next write or until closed", async () => {
    const tracker = createSaveTracker();
    const rejected = new ApiError(400, "Name darf nicht leer sein.");
    await expect(tracker.track(() => Promise.reject(rejected))).rejects.toBe(rejected);
    expect(tracker.getSnapshot()).toEqual({
      state: "failed",
      pending: 0,
      unsaved: 0,
      failure: { message: "Name darf nicht leer sein.", retryable: false }
    });

    const next = deferred();
    void tracker.track(() => next.promise);
    expect(tracker.getSnapshot()).toMatchObject({ state: "saving", failure: null });
    next.resolve("ok");
    await flush();
    expect(tracker.getSnapshot().state).toBe("saved");

    await expect(tracker.track(() => Promise.reject(rejected))).rejects.toBe(rejected);
    tracker.dismiss();
    expect(tracker.getSnapshot().state).toBe("saved");
  });

  it("forgets the session on logout, so nothing is re-sent under another login", async () => {
    const tracker = createSaveTracker();
    const heldError = offline();
    const heldSend = vi.fn(() => Promise.reject(heldError));
    const held = tracker.track(heldSend);
    const inFlight = deferred();
    const late = tracker.track(() => inFlight.promise);
    await expect(tracker.track(() => Promise.reject(new ApiError(400, "Ungültig")))).rejects.toBeInstanceOf(ApiError);
    await flush();

    tracker.reset();
    await expect(held).rejects.toBe(heldError);
    expect(tracker.getSnapshot()).toEqual({ state: "saving", pending: 1, unsaved: 0, failure: null });

    inFlight.reject(offline());
    await expect(late).rejects.toBeInstanceOf(TypeError);
    expect(tracker.getSnapshot()).toEqual({ state: "saved", pending: 0, unsaved: 0, failure: null });
    await tracker.retry();
    expect(heldSend).toHaveBeenCalledTimes(1);
  });

  it("stops a running retry on logout", async () => {
    const tracker = createSaveTracker();
    const firstRetry = deferred();
    const first = vi.fn().mockRejectedValueOnce(offline()).mockReturnValueOnce(firstRetry.promise);
    const second = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValueOnce("must not be sent");
    void tracker.track(first);
    const secondResult = tracker.track(second);
    await flush();

    const retrying = tracker.retry();
    tracker.reset();
    firstRetry.resolve("sent before logout");
    await retrying;

    expect(second).toHaveBeenCalledTimes(1);
    await expect(secondResult).rejects.toBeInstanceOf(TypeError);
    expect(tracker.getSnapshot()).toEqual({ state: "saved", pending: 0, unsaved: 0, failure: null });
  });

  it("notifies subscribers on every change", async () => {
    const tracker = createSaveTracker();
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    await tracker.track(() => Promise.resolve(1));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await tracker.track(() => Promise.resolve(2));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("save error classification (#117)", () => {
  it.each([
    [offline(), true],
    [new ApiError(500, "Internal Server Error"), true],
    [new ApiError(502, "Bad Gateway"), true],
    [new ApiError(408, "Request Timeout"), true],
    [new ApiError(429, "Too Many Requests"), true],
    [new ApiError(400, "Ungültig"), false],
    [new ApiError(403, "Keine Berechtigung"), false],
    [new ApiError(404, "Nicht gefunden"), false],
    [new ApiError(409, "Konflikt"), false],
    [new SyntaxError("Unexpected token"), false]
  ])("treats %s as retryable: %s", (error, retryable) => {
    expect(isRetryableSaveError(error)).toBe(retryable);
  });

  it("uses the server message for rejections and a German text otherwise", () => {
    expect(saveErrorMessage(new ApiError(400, "Name darf nicht leer sein."))).toBe("Name darf nicht leer sein.");
    expect(saveErrorMessage(new ApiError(500, "Internal Server Error"))).toBe("Serverfehler (HTTP 500).");
    expect(saveErrorMessage(offline())).toBe("Der Server ist nicht erreichbar.");
  });
});

describe("sidebarApi writes go through the save tracker (#117)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadApi(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("window", { localStorage: { getItem: () => null }, dispatchEvent: () => true });
    vi.stubGlobal("fetch", fetchMock);
    const { sidebarApi } = await import("./Sidebar/sidebarApi");
    const { saveTracker } = await import("./saveTracker");
    return { sidebarApi, saveTracker };
  }

  it("tracks a write and reports saved after the server answered", async () => {
    const answer = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    const { sidebarApi, saveTracker } = await loadApi(vi.fn(() => answer.promise));
    const result = sidebarApi.updateDiagram("d1", { name: "Neu" }, 3);
    expect(saveTracker.getSnapshot().state).toBe("saving");

    answer.resolve({ ok: true, status: 200, json: async () => ({ id: "d1", name: "Neu", version: 4 }) });
    await expect(result).resolves.toMatchObject({ version: 4 });
    expect(saveTracker.getSnapshot().state).toBe("saved");
  });

  it("holds a write that did not reach the server and sends it again on retry", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "d1", version: 4 }) });
    const { sidebarApi, saveTracker } = await loadApi(fetchMock);
    const result = sidebarApi.updateDiagram("d1", { name: "Neu" }, 3);
    await flush();
    expect(saveTracker.getSnapshot()).toMatchObject({ state: "failed", unsaved: 1 });

    await saveTracker.retry();
    await expect(result).resolves.toMatchObject({ version: 4 });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>)["If-Match"]).toBe("3");
  });

  it("does not track reads", async () => {
    const { sidebarApi, saveTracker } = await loadApi(vi.fn(async () => { throw offline(); }));
    await expect(sidebarApi.getAll()).rejects.toThrow("Failed to fetch");
    await expect(sidebarApi.validateDiagram("d1")).rejects.toThrow("Failed to fetch");
    expect(saveTracker.getSnapshot()).toEqual({ state: "saved", pending: 0, unsaved: 0, failure: null });
  });
});
