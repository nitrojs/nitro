import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import storage from "../../src/build/virtual/storage.ts";

function createNitroStub(tracingChannel: Nitro["options"]["tracingChannel"]): Nitro {
  return {
    options: {
      dev: true,
      preset: "nitro-dev",
      storage: {},
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
});
