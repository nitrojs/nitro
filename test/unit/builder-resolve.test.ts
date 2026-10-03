import type { NitroOptions } from "nitro/types";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rolldown: undefined as string | undefined }));

vi.mock("../../src/build/rolldown/_import.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/build/rolldown/_import.ts")>()),
  resolveRolldown: () => state.rolldown,
}));

const { resolveBuilder } = await import("../../src/config/resolvers/builder.ts");

describe("resolveBuilder", () => {
  let rootDir: string;
  const originalBuilder = process.env.NITRO_BUILDER;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-builder-"));
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
    if (originalBuilder === undefined) {
      delete process.env.NITRO_BUILDER;
    } else {
      process.env.NITRO_BUILDER = originalBuilder;
    }
  });

  beforeEach(() => {
    delete process.env.NITRO_BUILDER;
    state.rolldown = undefined;
  });

  async function resolve(opts: Partial<NitroOptions>) {
    const options = { rootDir, ...opts } as NitroOptions;
    await resolveBuilder(options);
    return options.builder;
  }

  it("defaults to rolldown when installed", async () => {
    state.rolldown = "/rolldown/index.mjs";
    expect(await resolve({ dev: true })).toBe("rolldown");
    expect(await resolve({ dev: false })).toBe("rolldown");
  });

  it("runs the dev server without a builder when rolldown is not installed", async () => {
    expect(await resolve({ dev: true })).toBe(false);
  });

  it("builds with rolldown (installed on demand) when it is not installed", async () => {
    expect(await resolve({ dev: false })).toBe("rolldown");
  });

  it("keeps an explicit `builder: false`", async () => {
    state.rolldown = "/rolldown/index.mjs";
    expect(await resolve({ dev: false, builder: false })).toBe(false);
  });
});
