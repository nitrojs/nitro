import { cp, mkdir, mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { dirname, join } from "pathe";

const rstestEntry = fileURLToPath(import.meta.resolve("@rstest/core"));
const rstestBin = join(dirname(rstestEntry), "../bin/rstest.js");

/**
 * Copies a fixture outside of the repository (where `nitro` only resolves as a dependency of the
 * project, like in a user project), linking `nitro` and `@rstest/core`.
 */
export async function copyFixture(fixtureDir: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nitro-rstest-"));
  await cp(fixtureDir, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
  await mkdir(join(dir, "node_modules/@rstest"), { recursive: true });
  const repoDir = fileURLToPath(new URL("../..", import.meta.url));
  await symlink(repoDir, join(dir, "node_modules/nitro"), "junction");
  await symlink(
    join(dirname(rstestEntry), ".."),
    join(dir, "node_modules/@rstest/core"),
    "junction"
  );
  return dir;
}

/** Environment of a user running Rstest (no `NODE_ENV`, `VITEST_*` or `NITRO_PRESET`). */
export function cleanEnv(env: Record<string, string> = {}): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key !== "NODE_ENV" && key !== "NITRO_PRESET" && !key.startsWith("VITEST")
      )
    ),
    ...env,
  };
}

/** Runs `rstest run` with the JSON reporter, returning the failed tests and the output. */
export async function runRstest(
  cwd: string,
  opts: { args?: string[]; env?: Record<string, string>; bin?: string } = {}
) {
  const { stdout, stderr } = await execa(
    process.execPath,
    [opts.bin || rstestBin, "run", "--reporter", "json", ...(opts.args || [])],
    { cwd, env: cleanEnv(opts.env), extendEnv: false, reject: false }
  );
  const output = stdout + stderr;
  let results: any;
  try {
    results = JSON.parse(stdout.slice(stdout.indexOf("{")));
  } catch {
    throw new Error(`Rstest did not report results:\n${output}`);
  }
  const failures: string[] = results.files.flatMap((file: any) =>
    file.results
      .filter((t: any) => t.status !== "pass")
      .map((t: any) => `${t.testPath} > ${t.fullName}: ${JSON.stringify(t.errors)}`)
  );
  return { results, failures, output };
}
