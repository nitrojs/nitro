import { describe, expect, it, vi } from "vitest";
import { H3 } from "h3";

let mockRuntimeConfig: Record<string, any> = {};

vi.mock("#nitro/virtual/routing-meta", () => ({
  handlersMeta: [],
}));

vi.mock("../../src/runtime/internal/runtime-config.ts", () => ({
  useRuntimeConfig: () => mockRuntimeConfig,
}));

const { default: openapiHandler } = await import("../../src/runtime/internal/routes/openapi.ts");

function createApp() {
  return new H3().get("/_openapi.json", openapiHandler);
}

describe("openapi route", () => {
  it("respects x-forwarded-proto and x-forwarded-host headers", async () => {
    mockRuntimeConfig = { app: { baseURL: "/" } };
    const app = createApp();

    const res = await app.request("http://127.0.0.1:3917/_openapi.json", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "example.com",
      },
    });
    const spec = await res.json();

    expect(spec.servers).toEqual([
      {
        url: "https://example.com",
        variables: {},
      },
    ]);
  });

  it("omits Local Development Server description outside dev mode", async () => {
    mockRuntimeConfig = {};
    const app = createApp();

    const res = await app.request("http://127.0.0.1:3917/_openapi.json");
    const spec = await res.json();

    expect(spec.servers).toEqual([
      {
        url: "http://127.0.0.1:3917",
        variables: {},
      },
    ]);
    expect(spec.servers[0].description).toBeUndefined();
  });

  it("uses configured openAPI.servers when provided", async () => {
    mockRuntimeConfig = {
      nitro: {
        openAPI: {
          servers: [{ url: "https://api.example.com", description: "Production" }],
        },
      },
    };
    const app = createApp();

    const res = await app.request("http://127.0.0.1:3917/_openapi.json");
    const spec = await res.json();

    expect(spec.servers).toEqual([{ url: "https://api.example.com", description: "Production" }]);
  });
});
