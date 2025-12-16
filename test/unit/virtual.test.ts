import { describe, expect, it } from "vitest";

import { serverFetch } from "nitro/app";

describe("virtual modules", () => {
  it("app fetch", async () => {
    const res = await serverFetch("/");
    expect(res.status).toBe(404);
    expect(await res.text()).to.include("Cannot find any route matching");
  });
});
