import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";

const mockedDeps = new Set<string>();

vi.mock("../../src/utils/dep.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/utils/dep.ts")>();
  return {
    ...original,
    isDepInstalled: (id: string, dir: string, opts?: { projectOnly?: boolean }) =>
      mockedDeps.has(id) || original.isDepInstalled(id, dir, opts),
  };
});

const { default: storage } = await import("../../src/build/virtual/storage.ts");

function createNitroStub(
  tracingChannel: Nitro["options"]["tracingChannel"],
  storage: Nitro["options"]["storage"] = {}
): Nitro {
  return {
    options: {
      dev: true,
      preset: "nitro-dev",
      rootDir: process.cwd(),
      storage,
      devStorage: {},
      tracingChannel,
    },
  } as unknown as Nitro;
}

describe("virtual/storage template", () => {
  it("does not wrap storage when tracingChannel is disabled", () => {
    const template = storage(createNitroStub(undefined)).template();
    expect(template).not.toContain("withTracing");
    expect(template).not.toContain("unstorage/tracing");
    expect(template).toContain("return storage");
  });

  it("does not wrap storage when tracingChannel.unstorage is false", () => {
    const template = storage(
      createNitroStub({ srvx: true, h3: true, unstorage: false })
    ).template();
    expect(template).not.toContain("withTracing");
  });

  it("wraps storage with withTracing when tracingChannel.unstorage is true", () => {
    const template = storage(createNitroStub({ srvx: true, h3: true, unstorage: true })).template();
    expect(template).toContain(`import { withTracing } from 'unstorage/tracing'`);
    expect(template).toContain("return withTracing(storage)");
  });

  it("provides installed driver dependencies via the `lib` option", () => {
    const template = storage(
      createNitroStub(undefined, { "/data": { driver: "fs", base: "./data" } })
    ).template();
    expect(template).toContain(
      `storage.mount('/data', unstorage_47drivers_47fs({ ...{"base":"./data"}, lib: () => import("chokidar") }))`
    );
  });

  it("uses the driver import specifier when it differs from the package name", () => {
    mockedDeps.add("uploadthing");
    try {
      const template = storage(
        createNitroStub(undefined, { "/files": { driver: "uploadthing", token: "x" } })
      ).template();
      expect(template).toContain(`lib: () => import("uploadthing/server")`);
    } finally {
      mockedDeps.clear();
    }
  });

  it("does not provide `lib` for dependencies that are not installed", () => {
    const template = storage(
      createNitroStub(undefined, { "/cache": { driver: "redis", base: "cache" } })
    ).template();
    expect(template).toContain(
      `storage.mount('/cache', unstorage_47drivers_47redis({"base":"cache"}))`
    );
    expect(template).not.toContain("ioredis");
  });

  it("does not provide `lib` for dependencies only resolvable from nitro itself", () => {
    const nitro = createNitroStub(undefined, { "/data": { driver: "fs", base: "./data" } });
    nitro.options.rootDir = tmpdir();
    const template = storage(nitro).template();
    expect(template).toContain(
      `storage.mount('/data', unstorage_47drivers_47fs({"base":"./data"}))`
    );
    expect(template).not.toContain("chokidar");
  });

  it("does not override a user provided `lib` option", () => {
    const template = storage(
      createNitroStub(undefined, { "/data": { driver: "fs", lib: null } })
    ).template();
    expect(template).not.toContain("chokidar");
  });
});
