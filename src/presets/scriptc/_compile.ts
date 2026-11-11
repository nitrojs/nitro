import type { Nitro } from "nitro/types";
import { spawn } from "node:child_process";
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
  const bin = resolveScriptc(nitro.options.rootDir);
  const args = [
    "build",
    entry,
    "--node-islands=off",
    "--no-keep-llvm",
    "-o",
    output,
    ...(nitro.options.scriptc?.args || []),
  ];

  const start = Date.now();
  const code = await new Promise<number | "ENOENT">((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "inherit" });
    child.on("error", (error: NodeJS.ErrnoException) =>
      error.code === "ENOENT" ? resolve("ENOENT") : reject(error)
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (code === "ENOENT") {
    const command = ["scriptc", ...args]
      .map((arg) => (arg === entry || arg === output ? relative(process.cwd(), arg) : arg))
      .join(" ");
    nitro.logger.warn(
      `Could not find \`scriptc\` to compile the server. Install it (\`npm i -D scriptc\`) or set \`SCRIPTC\`, then run \`${command}\`.`
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

function resolveScriptc(rootDir: string): string {
  if (process.env.SCRIPTC) {
    return process.env.SCRIPTC;
  }
  const pkg = resolveModulePath("scriptc/package.json", { from: rootDir, try: true });
  return pkg ? join(dirname(pkg), "bin/scriptc.exe") : "scriptc";
}
