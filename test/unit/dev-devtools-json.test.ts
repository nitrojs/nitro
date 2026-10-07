import type { Nitro } from "nitro/types";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";

const ROUTE = "/.well-known/appspecific/com.chrome.devtools.json";

describe("NitroDevApp devtools json", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-devtools-json-"));
  const buildDir = join(rootDir, "node_modules/.nitro/");
  afterAll(() => rm(rootDir, { recursive: true, force: true }));

  const createApp = (opts: { baseURL?: string; devtoolsJson?: boolean } = {}) =>
    new NitroDevApp({
      logger: console,
      options: {
        rootDir: rootDir + "/",
        buildDir,
        baseURL: opts.baseURL || "/",
        devServer: { devtoolsJson: opts.devtoolsJson },
        devHandlers: [],
        publicAssets: [],
        devProxy: {},
      },
    } as unknown as Nitro);

  const fetchJSON = async (app: NitroDevApp, path = ROUTE) => {
    const res = await app.fetch(new Request(`http://localhost${path}`));
    expect(res.status).toBe(200);
    return (await res.json()) as { workspace: { root: string; uuid: string } };
  };

  it("serves workspace root and a persisted uuid", async () => {
    const app = createApp();
    expect(app.hasRoute("GET", ROUTE)).toBe(true);
    const { workspace } = await fetchJSON(app);
    expect(workspace.root).toBe(rootDir);
    expect(workspace.uuid).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/);
    expect(await readFile(join(buildDir, "devtools-uuid"), "utf8")).toBe(workspace.uuid);
    expect((await fetchJSON(createApp())).workspace.uuid).toBe(workspace.uuid);
  });

  it("serves the endpoint with and without baseURL prefix", async () => {
    const app = createApp({ baseURL: "/app/" });
    await fetchJSON(app);
    await fetchJSON(app, `/app${ROUTE}`);
  });

  it("can be disabled", async () => {
    const app = createApp({ devtoolsJson: false });
    expect(app.hasRoute("GET", ROUTE)).toBe(false);
    const res = await app.fetch(new Request(`http://localhost${ROUTE}`));
    expect(res.status).toBe(404);
  });
});
