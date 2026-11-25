import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { SaveFailureBanner, SaveStatusIndicator } from "./SaveStatus";
import type { SaveSnapshot, SaveTracker } from "./saveTracker";

const saved: SaveSnapshot = { state: "saved", pending: 0, unsaved: 0, failure: null };
const saving: SaveSnapshot = { state: "saving", pending: 1, unsaved: 0, failure: null };
const unsaved: SaveSnapshot = { state: "failed", pending: 0, unsaved: 2, failure: { message: "Der Server ist nicht erreichbar.", retryable: true } };
const rejected: SaveSnapshot = { state: "failed", pending: 0, unsaved: 0, failure: { message: "Name darf nicht leer sein.", retryable: false } };

function fakeTracker(discarded = 1) {
  return {
    retry: vi.fn(async () => {}),
    discard: vi.fn(() => discarded),
    dismiss: vi.fn()
  } as unknown as SaveTracker & { retry: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
}

function button(renderer: ReactTestRenderer, text: string) {
  const label = (item: { children: unknown[]; props: Record<string, unknown> }) =>
    item.props["aria-label"] ?? item.children.filter((child) => typeof child === "string").join("").trim();
  return renderer.root.findAllByType("button").find((item) => label(item) === text)!;
}

describe("save status in the header (#117)", () => {
  it.each([
    [saved, "Alles gespeichert"],
    [saving, "Speichern läuft …"],
    [unsaved, "Speichern fehlgeschlagen"],
    [rejected, "Speichern fehlgeschlagen"]
  ])("shows the state as text for %#", (status, text) => {
    const html = renderToStaticMarkup(<SaveStatusIndicator status={status} />);
    expect(html).toContain(text);
    expect(html).toContain('role="status"');
    expect(html).toContain(`save-status--${status.state}`);
  });
});

describe("save failure banner (#117)", () => {
  it("is not shown while saving or when everything is saved", () => {
    expect(renderToStaticMarkup(<SaveFailureBanner status={saved} tracker={fakeTracker()} onDiscarded={() => {}} />)).toBe("");
    expect(renderToStaticMarkup(<SaveFailureBanner status={saving} tracker={fakeTracker()} onDiscarded={() => {}} />)).toBe("");
  });

  it("explains unsaved changes and offers retry and discard", async () => {
    const tracker = fakeTracker();
    const onDiscarded = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SaveFailureBanner status={unsaved} tracker={tracker} onDiscarded={onDiscarded} />); });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("2 Änderungen sind nicht gespeichert.");
    expect(text).toContain("Der Server ist nicht erreichbar.");
    expect(renderer.root.findByProps({ role: "alert" })).toBeTruthy();

    await act(async () => { button(renderer, "Erneut versuchen").props.onClick(); });
    expect(tracker.retry).toHaveBeenCalledTimes(1);

    await act(async () => { button(renderer, "Verwerfen").props.onClick(); });
    expect(tracker.discard).toHaveBeenCalledTimes(1);
    expect(onDiscarded).toHaveBeenCalledTimes(1);
  });

  it("does not reload when nothing was left to discard", async () => {
    const onDiscarded = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SaveFailureBanner status={unsaved} tracker={fakeTracker(0)} onDiscarded={onDiscarded} />); });
    await act(async () => { button(renderer, "Verwerfen").props.onClick(); });
    expect(onDiscarded).not.toHaveBeenCalled();
  });

  it("shows a rejection with the server's reason and no retry", async () => {
    const tracker = fakeTracker();
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SaveFailureBanner status={rejected} tracker={tracker} onDiscarded={() => {}} />); });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("Die letzte Änderung wurde nicht gespeichert.");
    expect(text).toContain("Name darf nicht leer sein.");
    expect(text).not.toContain("Erneut versuchen");

    await act(async () => { button(renderer, "Meldung schließen").props.onClick(); });
    expect(tracker.dismiss).toHaveBeenCalledTimes(1);
  });
});
