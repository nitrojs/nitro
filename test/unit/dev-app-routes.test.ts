import type { Nitro } from "nitro/types";
import { joinURL } from "ufo";
import { describe, expect, it } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";

describe.each(["/", "/app/"])("NitroDevApp.hasRoute (baseURL: %s)", (baseURL) => {
  const url = (path: string) => joinURL(baseURL, path);
  const handler = () => "ok";
  const app = new NitroDevApp({
    logger: console,
    options: {
      baseURL,
      devHandlers: [
        { route: url("/_dev/**"), handler },
        { route: url("/_get/**"), method: "get", handler },
        { route: url("/_mw"), middleware: true, handler },
        { route: url("/**"), handler },
        { route: url("/**:slug"), handler },
      ],
      publicAssets: [
        { dir: "/tmp/pub", baseURL: "/pub", fallthrough: false },
        { dir: "/tmp/ft", baseURL: "/ft", fallthrough: true },
        { dir: "/tmp/root", baseURL: "/", fallthrough: false },
      ],
      devProxy: {
        [url("/_proxy/**")]: { target: "http://127.0.0.1:1" },
      },
    },
  } as unknown as Nitro);

  it("matches dev handler routes", () => {
    expect(app.hasRoute("GET", url("/_dev/a.woff2"))).toBe(true);
    expect(app.hasRoute("post", url("/_dev/a"))).toBe(true);
  });

  it("matches dev handler methods", () => {
    expect(app.hasRoute("GET", url("/_get/a"))).toBe(true);
    expect(app.hasRoute("get", url("/_get/a"))).toBe(true);
    expect(app.hasRoute("HEAD", url("/_get/a"))).toBe(true);
    expect(app.hasRoute("POST", url("/_get/a"))).toBe(false);
  });

  it("matches dev proxies", () => {
    expect(app.hasRoute("GET", url("/_proxy/a.js"))).toBe(true);
  });

  it("skips middleware and root catch-alls", () => {
    expect(app.hasRoute("GET", url("/_mw"))).toBe(false);
    expect(app.hasRoute("GET", url("/other.js"))).toBe(false);
  });

  it("matches files under public asset dirs without fallthrough", () => {
    expect(app.hasRoute("GET", url("/pub/x.txt"))).toBe(true);
    expect(app.hasRoute("GET", url("/pub/a/b"))).toBe(true);
    expect(app.hasRoute("GET", url("/pub"))).toBe(false);
    expect(app.hasRoute("GET", url("/pub/"))).toBe(false);
    expect(app.hasRoute("GET", url("/ft/x.txt"))).toBe(false);
  });
});
