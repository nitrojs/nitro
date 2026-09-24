import { describe, expect, it } from "vitest";
import { addNetlifyVaryHeader } from "../../src/presets/netlify/runtime/_utils.ts";

describe("addNetlifyVaryHeader", () => {
  it("sets Netlify-Vary: query when Cache-Control has s-maxage", () => {
    const headers = new Headers({
      "Cache-Control": "max-age=60, s-maxage=60, stale-while-revalidate=86400",
    });
    addNetlifyVaryHeader(headers);
    expect(headers.get("Netlify-Vary")).toBe("query");
  });

  it("does not set Netlify-Vary when Cache-Control has no s-maxage", () => {
    const headers = new Headers({ "Cache-Control": "public, max-age=3600, immutable" });
    addNetlifyVaryHeader(headers);
    expect(headers.has("Netlify-Vary")).toBe(false);
  });

  it("does not set Netlify-Vary when there is no Cache-Control header", () => {
    const headers = new Headers();
    addNetlifyVaryHeader(headers);
    expect(headers.has("Netlify-Vary")).toBe(false);
  });

  it("does not overwrite an existing Netlify-Vary header", () => {
    const headers = new Headers({
      "Cache-Control": "s-maxage=60",
      "Netlify-Vary": "query=icons",
    });
    addNetlifyVaryHeader(headers);
    expect(headers.get("Netlify-Vary")).toBe("query=icons");
  });
});
