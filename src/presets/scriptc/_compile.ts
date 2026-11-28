import type { Nitro } from "nitro/types";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolveModulePath } from "exsolve";
import { dirname, join, relative } from "pathe";

/**
 * Compile the server bundle into a native executable with `scriptc`.
 *
 * The binary is resolved from `SCRIPTC`, the project's `scriptc` package, or `PATH`.
 */
export async function compileScriptc(nitro: Nitro): Promise<void> {
  const serverDir = nitro.options.output.serverDir;
  const entry = join(serverDir, "index.mjs");
  const output = join(serverDir, "index");
  const scriptc = resolveScriptc(nitro.options.rootDir);
  const args = [
    "build",
    entry,
    "--node-islands=off",
    "--no-keep-llvm",
    "-o",
    output,
    ...(nitro.options.scriptc?.args || []),
  ];
  const command = ["scriptc", ...args]
    .map((arg) => (arg === entry || arg === output ? relative(process.cwd(), arg) : arg))
    .join(" ");

  if (scriptc.from === "package" && (await isPlaceholder(scriptc.bin))) {
    nitro.logger.warn(
      `The \`scriptc\` package is installed, but its native compiler is not: its install script did not run (pnpm and bun block install scripts by default). Allow install scripts for \`scriptc\` and reinstall it, then run \`${command}\`.`
    );
    return;
  }

  const start = Date.now();
  const code = await new Promise<number | "ENOENT">((resolve, reject) => {
    const child = spawn(scriptc.bin, args, { stdio: "inherit" });
    child.on("error", (error: NodeJS.ErrnoException) =>
      error.code === "ENOENT" ? resolve("ENOENT") : reject(error)
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (code === "ENOENT") {
    nitro.logger.warn(
      scriptc.from === "env"
        ? `\`SCRIPTC\` is set to \`${scriptc.bin}\`, which does not exist. Fix it, then run \`${command}\`.`
        : `Could not find \`scriptc\` to compile the server. Install it (\`npm i -D scriptc\`) or set \`SCRIPTC\` to its path, then run \`${command}\`.`
    );
    return;
  }
  if (code !== 0) {
    throw new Error(
      `\`scriptc\` failed to compile \`${relative(process.cwd(), entry)}\` (exit code ${code}).`
    );
  }
  nitro.logger.success(
    `Compiled native executable \`${relative(process.cwd(), output)}\` with scriptc in ${Date.now() - start}ms`
  );
}

function resolveScriptc(rootDir: string): { bin: string; from: "env" | "package" | "path" } {
  if (process.env.SCRIPTC) {
    return { bin: process.env.SCRIPTC, from: "env" };
  }
  const pkg = resolveModulePath("scriptc/package.json", { from: rootDir, try: true });
  return pkg
    ? { bin: join(dirname(pkg), "bin/scriptc.exe"), from: "package" }
    : { bin: "scriptc", from: "path" };
}

// The npm package ships a small shell script that its install script replaces with the compiler
async function isPlaceholder(bin: string): Promise<boolean> {
  const stats = await stat(bin).catch(() => undefined);
  return !stats || stats.size < 4096;
}
