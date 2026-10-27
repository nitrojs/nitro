import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { VirtualPlaceholders } from "../../src/build/rspack/_virtual.ts";

describe("rspack: virtual placeholders", () => {
  const dir = mkdtempSync(join(tmpdir(), "nitro-rspack-virtual-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const virtual = new VirtualPlaceholders(join(dir, "virtual"));

  it("maps placeholder resources with native separators to their id", () => {
    const placeholder = virtual.toRequest("#nitro/virtual/routing");
    expect(placeholder.startsWith(join(dir, "virtual") + "/")).toBe(true);
    const native = placeholder.replace(/\//g, "\\");
    expect(virtual.toId(native)).toBe("#nitro/virtual/routing");
    expect(virtual.isVirtual(native)).toBe(true);
    expect(virtual.toId(placeholder)).toBe("#nitro/virtual/routing");
  });

  it("keeps the extension of TypeScript virtual modules", () => {
    expect(virtual.toRequest("\0virtual:app.tsx")).toMatch(/\.tsx$/);
    expect(virtual.toRequest("\0virtual:app")).toMatch(/\.mjs$/);
  });

  it("leaves existing files and other resources as is", () => {
    const file = String.raw`C:\app\server\routes\index.ts`;
    expect(virtual.toId(file)).toBe(file);
    expect(virtual.isVirtual(file)).toBe(false);
    expect(virtual.toRequest(import.meta.filename)).toBe(import.meta.filename);
  });
});
