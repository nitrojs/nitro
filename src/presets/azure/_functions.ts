import fsp from "node:fs/promises";
import { resolveModulePath } from "exsolve";
import { resolve } from "pathe";
import { writeFile } from "../_utils/fs.ts";
import { ensureDep } from "../../utils/dep.ts";
import type { Nitro } from "nitro/types";

export async function setupAzureFunctions(nitro: Nitro) {
  const azure = (nitro.options.azure ??= {});
  azure.functionsVersion ??= 4;
  if (azure.functionsVersion !== 3 && azure.functionsVersion !== 4) {
    throw new Error(
      `Invalid \`azure.functionsVersion\`: \`${azure.functionsVersion}\`. Supported values are \`3\` and \`4\`.`
    );
  }

  if (azure.functionsVersion === 4) {
    const reason = "the Azure Functions v4 programming model";
    const installedVersion = await getInstalledFunctionsVersion(nitro.options.rootDir);
    if (!installedVersion) {
      const resolved = await ensureDep({
        id: "@azure/functions",
        dir: nitro.options.rootDir,
        reason,
        version: "^4",
        dev: false,
        projectOnly: true,
      });
      if (!resolved) {
        throw new Error(
          `\`@azure/functions@^4\` is not installed. Please add it to your dependencies for ${reason}, or set \`azure.functionsVersion\` to \`3\` to use the legacy programming model.`
        );
      }
    } else if (installedVersion < 4) {
      throw new Error(
        `\`@azure/functions@${installedVersion}\` is installed, but ${reason} requires \`@azure/functions@^4\`. Please update it in your dependencies, or set \`azure.functionsVersion\` to \`3\` to use the legacy programming model.`
      );
    }
    (nitro.options.traceDeps ??= []).push("@azure/functions");
  }

  nitro.options.entry = nitro.options.entry.replace("{version}", `v${azure.functionsVersion}`);
}

export async function writeFunctionFiles(nitro: Nitro) {
  const serverDir = nitro.options.output.serverDir;
  if (nitro.options.azure?.functionsVersion === 4) {
    await writeFile(
      resolve(serverDir, "../package.json"),
      JSON.stringify({ private: true, type: "module", main: "functions/index.mjs" }, null, 2)
    );
  } else {
    await writeFile(
      resolve(serverDir, "function.json"),
      JSON.stringify(
        {
          entryPoint: "handle",
          bindings: [
            {
              authLevel: "anonymous",
              type: "httpTrigger",
              direction: "in",
              name: "req",
              route: "{*url}",
              methods: ["delete", "get", "head", "options", "patch", "post", "put"],
            },
            { type: "http", direction: "out", name: "res" },
          ],
        },
        null,
        2
      )
    );
    await writeFile(resolve(serverDir, "../package.json"), JSON.stringify({ private: true }));
  }
  // Used by Azure Functions Core Tools (`func` / `swa start`) for local preview
  await writeFile(
    resolve(serverDir, "../local.settings.json"),
    JSON.stringify({ IsEncrypted: false, Values: { FUNCTIONS_WORKER_RUNTIME: "node" } }, null, 2)
  );
}

async function getInstalledFunctionsVersion(rootDir: string): Promise<number | undefined> {
  const pkgPath = resolveModulePath("@azure/functions/package.json", {
    from: rootDir,
    try: true,
  });
  if (!pkgPath) {
    return undefined;
  }
  const { version } = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
  return Number.parseInt(version, 10) || undefined;
}
