import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./authApi";
import { runOptimisticMutation } from "./optimisticConflict";

const conflict = (version: number) => new ApiError(409, "conflict", {
  code: "OPTIMISTIC_LOCK_CONFLICT",
  current: { version }
});

describe("optimistic conflict UI workflow", () => {
  it("retries only against each newly reported current version", async () => {
    const attempted: number[] = [];
    const choose = vi.fn(async () => "overwrite" as const);
    const result = await runOptimisticMutation(
      1,
      async (version) => {
        attempted.push(version);
        if (version === 1) throw conflict(2);
        if (version === 2) throw conflict(3);
        return "saved";
      },
      vi.fn(),
      choose
    );
    expect(result).toEqual({ applied: true, value: "saved" });
    expect(attempted).toEqual([1, 2, 3]);
    expect(choose).toHaveBeenCalledTimes(2);
  });

  it("reloads explicitly and does not resubmit the preserved draft", async () => {
    const attempt = vi.fn(async () => { throw conflict(2); });
    const reload = vi.fn(async () => undefined);
    const result = await runOptimisticMutation(1, attempt, reload, async () => "reload");
    expect(result).toEqual({ applied: false });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
