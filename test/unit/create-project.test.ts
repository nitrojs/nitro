import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import {
  createProject,
  isEmptyDir,
  projectTemplates,
} from "../../src/cli/commands/create/_project.ts";
import pkg from "../../package.json" with { type: "json" };

const temporaryDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function tmpDir() {
  const dir = await mkdtemp(join(tmpdir(), "nitro-create-"));
  temporaryDirs.push(dir);
  return dir;
}

describe("createProject", () => {
  it.each(projectTemplates.map((t) => t.name))(
    "creates a project from the `%s` template",
    async (template) => {
      const dir = join(await tmpDir(), "My App");
      await createProject(dir, { template });

      expect(existsSync(join(dir, ".gitignore"))).toBe(true);
      expect(existsSync(join(dir, "nitro.config.ts"))).toBe(true);
      expect(existsSync(join(dir, "server/api/hello.ts"))).toBe(true);

      const projectPkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
      expect(projectPkg.name).toBe("my-app");
      expect(projectPkg.dependencies.nitro).toBe(`^${pkg.version}`);
    }
  );

  it("refuses a non-empty directory unless forced", async () => {
    const dir = await tmpDir();
    await writeFile(join(dir, "package.json"), "{}");

    await expect(createProject(dir, { template: "rolldown" })).rejects.toThrow(
      /not empty.*--force/
    );
    const { overwritten } = await createProject(dir, { template: "rolldown", force: true });
    expect(overwritten).toEqual(["package.json"]);
    expect(JSON.parse(await readFile(join(dir, "package.json"), "utf8")).scripts.dev).toBe(
      "nitro dev"
    );
  });

  it("rejects an unknown template", async () => {
    const dir = await tmpDir();
    await expect(createProject(dir, { template: "nope" })).rejects.toThrow(
      /Unknown template `nope`.*`vite`, `rolldown`, `rspack`, `runtime`/
    );
  });

  it("treats a directory with only `.git` as empty", async () => {
    const dir = await tmpDir();
    await mkdir(join(dir, ".git"));
    expect(await isEmptyDir(dir)).toBe(true);
    await writeFile(join(dir, "README.md"), "");
    expect(await isEmptyDir(dir)).toBe(false);
  });
});
