import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { nitro } from "nitro/vite";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");
const temporaryDir = fileURLToPath(new URL("../.tmp/", import.meta.url));
let rootDir: string;
let server: ViteDevServer;
let serverURL: string;

beforeAll(async () => {
  await mkdir(temporaryDir, { recursive: true });
  rootDir = await mkdtemp(join(temporaryDir, "openapi-reload-"));
  await mkdir(join(rootDir, "api"));
  await writeFile(
    join(rootDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
      },
      include: ["api/*.ts"],
    })
  );
  await writeFile(
    join(rootDir, "api/initial.get.ts"),
    'export default (): { before: string } => ({ before: "yes" });'
  );
  server = await createServer({
    root: rootDir,
    configFile: false,
    logLevel: "warn",
    plugins: [nitro({ serverDir: ".", experimental: { openAPI: true } })],
  });
  await server.listen(0);
  const address = server.httpServer!.address() as { port: number; address: string; family: string };
  serverURL = `http://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`;
}, 30_000);

afterAll(async () => {
  await server?.close();
  if (rootDir) {
    expect(rootDir.startsWith(join(temporaryDir, "openapi-reload-"))).toBe(true);
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("refreshes response schemas when a route is added or edited", async () => {
  expect(await responseSchema("initial")).toMatchObject({
    properties: { before: { type: "string" } },
  });

  await writeFile(
    join(rootDir, "api/added.get.ts"),
    "export default (): { added: boolean } => ({ added: true });"
  );
  await vi.waitFor(
    async () => {
      expect(await responseSchema("added")).toMatchObject({
        properties: { added: { type: "boolean" } },
      });
    },
    { timeout: 10_000, interval: 100 }
  );

  await writeFile(
    join(rootDir, "api/initial.get.ts"),
    "export default (): { after: number } => ({ after: 1 });"
  );
  await vi.waitFor(
    async () => {
      const schema = await responseSchema("initial");
      expect(schema).toMatchObject({ properties: { after: { type: "number" } } });
      expect(schema.properties).not.toHaveProperty("before");
    },
    { timeout: 10_000, interval: 100 }
  );
});

async function responseSchema(route: string) {
  const response = await fetch(`${serverURL}/_openapi.json`);
  expect(response.status).toBe(200);
  const spec: Record<string, any> = await response.json();
  return spec.paths[`/api/${route}`]?.get.responses[200].content?.["application/json"].schema;
}
