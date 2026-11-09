import { describe, expect, it } from "vitest";
import { AppWindow, Box, Database, Server, Workflow } from "lucide-react";
import { resolveComponentIcon } from "./componentIcons";

describe("resolveComponentIcon", () => {
  it("uses the explicit icon key", () => {
    expect(resolveComponentIcon("db", "Irgendwas")).toBe(Database);
    expect(resolveComponentIcon("app", "x")).toBe(AppWindow);
  });

  it("guesses from the type name when the key is generic", () => {
    expect(resolveComponentIcon("box", "Applikation")).toBe(AppWindow);
    expect(resolveComponentIcon("box", "Datenbank")).toBe(Database);
    expect(resolveComponentIcon(undefined, "IT-Server")).toBe(Server);
    expect(resolveComponentIcon("box", "Geschäftsprozess")).toBe(Workflow);
  });

  it("falls back to shape and then to a box", () => {
    expect(resolveComponentIcon("box", "Zzz", "datastore")).toBe(Database);
    expect(resolveComponentIcon("box", "Zzz")).toBe(Box);
  });
});
