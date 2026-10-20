import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";

const mockedDeps = new Set<string>();

const { isDepInstalled } =
  await vi.importActual<typeof import("../../src/utils/dep.ts")>("../../src/utils/dep.ts");

vi.mock("../../src/utils/dep.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/utils/dep.ts")>();
  return {
    ...original,
    isDepInstalled: (id: string, opts: Parameters<typeof original.isDepInstalled>[1]) =>
      mockedDeps.has(id) || original.isDepInstalled(id, opts),
  };
});

const { default: kv } = await import("../../src/build/virtual/kv.ts");

function createNitroStub(
  tracingChannel: Nitro["options"]["tracingChannel"],
  kv: Nitro["options"]["kv"] = {},
  serverTiming: Nitro["options"]["serverTiming"] = false
): Nitro {
  return {
    options: {
      dev: true,
      preset: "nitro-dev",
      rootDir: process.cwd(),
      kv,
      devStorage: {},
      tracingChannel,
      serverTiming,
    },
  } as unknown as Nitro;
}

describe("virtual/kv template", () => {
  it("does not wrap storage when tracingChannel is disabled", async () => {
    const template = await kv(createNitroStub(undefined)).template();
    expect(template).not.toContain("withTracing");
    expect(template).not.toContain("unstorage/tracing");
    expect(template).toContain("return storage");
  });

  it("does not wrap storage when tracingChannel.unstorage is false", async () => {
    const template = await kv(
      createNitroStub({ srvx: true, h3: true, unstorage: false })
    ).template();
    expect(template).not.toContain("withTracing");
  });

  it("wraps storage with withTracing when tracingChannel.unstorage is true", async () => {
    const template = await kv(
      createNitroStub({ srvx: true, h3: true, unstorage: true })
    ).template();
    expect(template).toContain(`import { withTracing } from 'unstorage/tracing'`);
    expect(template).toContain("return withTracing(storage)");
  });

  it("provides installed driver dependencies via the `lib` option", async () => {
    const template = await kv(
      createNitroStub(undefined, { "/data": { driver: "fs", base: "./data" } })
    ).template();
    expect(template).toContain(
      `storage.mount('/data', unstorage_47drivers_47fs({ ...{"base":"./data"}, lib: () => import("chokidar") }))`
    );
  });

  it("uses the driver import specifier when it differs from the package name", async () => {
    mockedDeps.add("uploadthing");
    try {
      const template = await kv(
        createNitroStub(undefined, { "/files": { driver: "uploadthing", token: "x" } })
      ).template();
      expect(template).toContain(`lib: () => import("uploadthing/server")`);
    } finally {
      mockedDeps.clear();
    }
  });

  it("does not provide `lib` for dependencies that are not installed", async () => {
    const template = await kv(
      createNitroStub(undefined, { "/cache": { driver: "redis", base: "cache" } })
    ).template();
    expect(template).toContain(
      `storage.mount('/cache', unstorage_47drivers_47redis({"base":"cache"}))`
    );
    expect(template).not.toContain("ioredis");
  });

  it("does not provide `lib` for dependencies only resolvable from nitro itself", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-storage-lib-"));
    expect(isDepInstalled("chokidar", { dir: rootDir })).toBe(true);
    expect(isDepInstalled("chokidar", { dir: rootDir, projectOnly: true })).toBe(false);

    const nitro = createNitroStub(undefined, { "/data": { driver: "fs", base: "./data" } });
    nitro.options.rootDir = rootDir;
    const template = await kv(nitro).template();
    expect(template).toContain(
      `storage.mount('/data', unstorage_47drivers_47fs({"base":"./data"}))`
    );
    expect(template).not.toContain("chokidar");
  });

  it("does not override a user provided `lib` option", async () => {
    const template = await kv(
      createNitroStub(undefined, { "/data": { driver: "fs", lib: null } })
    ).template();
    expect(template).not.toContain("chokidar");
  });

  it("wraps storage and records server timing when serverTiming.kv is enabled", () => {
    const template = kv(
      createNitroStub(undefined, {}, { total: true, kv: true, db: false, cache: true })
    ).template();
    expect(template).toContain("import { withTracing } from 'unstorage/tracing'");
    expect(template).toContain("const timed = traceServerTiming('kv')");
    // `withTracing` needs `node:diagnostics_channel`, which `traceServerTiming` checks for
    expect(template).toContain("return timed ? withTracing(storage) : storage");
  });

  it("always wraps storage when both serverTiming.kv and tracingChannel.unstorage are enabled", () => {
    const template = kv(
      createNitroStub(
        { srvx: true, h3: true, unstorage: true },
        {},
        { total: true, kv: true, db: false, cache: true }
      )
    ).template();
    expect(template).toContain("const timed = traceServerTiming('kv')");
    expect(template).toContain("return withTracing(storage)");
  });

  it("does not record server timing when serverTiming.kv is disabled", () => {
    const template = kv(
      createNitroStub(undefined, {}, { total: true, kv: false, db: false, cache: true })
    ).template();
    expect(template).not.toContain("traceServerTiming");
    expect(template).not.toContain("withTracing");
  });
});
