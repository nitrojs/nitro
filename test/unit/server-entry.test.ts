import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const tempDirs: string[] = [];

async function detectServerEntry(entry: string) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-server-entry-"));
  tempDirs.push(rootDir);

  const file = join(rootDir, entry);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `export default { fetch: () => new Response("ok") };\n`);

  const { loadOptions } = await import("../../src/config/loader.ts");
  const { serverEntry } = await loadOptions({
    rootDir,
    preset: "node-server",
    compatibilityDate: "latest",
  });
  return serverEntry as { handler: string } | false;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("server entry detection", () => {
  it("detects `server.ts` in the root directory", async () => {
    const serverEntry = await detectServerEntry("server.ts");
    expect(serverEntry).toBeTruthy();
    expect((serverEntry as { handler: string }).handler).toContain("/server.ts");
  });

  it("detects `server/index.ts`", async () => {
    const serverEntry = await detectServerEntry("server/index.ts");
    expect(serverEntry).toBeTruthy();
    expect((serverEntry as { handler: string }).handler).toContain("/server/index.ts");
  });
});
