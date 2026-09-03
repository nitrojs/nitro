import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import storage from "../../src/build/virtual/storage.ts";

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

  it("does not provide `lib` for dependencies that are not installed", () => {
    const template = storage(
      createNitroStub(undefined, { "/cache": { driver: "redis", base: "cache" } })
    ).template();
    expect(template).toContain(
      `storage.mount('/cache', unstorage_47drivers_47redis({"base":"cache"}))`
    );
    expect(template).not.toContain("ioredis");
  });

  it("does not override a user provided `lib` option", () => {
    const template = storage(
      createNitroStub(undefined, { "/data": { driver: "fs", lib: null } })
    ).template();
    expect(template).not.toContain("chokidar");
  });
});
