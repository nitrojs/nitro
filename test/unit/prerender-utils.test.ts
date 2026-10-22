import { describe, expect, it } from "vitest";
import { extractLinks, formatPrerenderRoute } from "../../src/prerender/utils.ts";
import type { PrerenderRoute } from "nitro/types";

describe("prerender utils", () => {
  it("reports parents of crawled links by their `baseURL`-relative route", async () => {
    const links = await extractLinks(
      `<a href="/base/missing">missing</a>`,
      "/base/parent",
      new Response(),
      true,
      "/base/"
    );
    expect(links).toEqual(["/base/missing"]);

    const error = Object.assign(new Error("[404] Not Found"), { status: 404 });
    const output = formatPrerenderRoute({ route: "/missing", error } as PrerenderRoute);
    expect(output).toContain("Linked from /base/parent");
  });
});
