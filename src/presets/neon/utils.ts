import type { Nitro } from "nitro/types";
import { relative, resolve } from "pathe";
import { writeFile } from "../_utils/fs.ts";

export const CRON_PATH_PREFIX = "/_neon/cron/";

export function warnUnsupportedFeatures(nitro: Nitro) {
  if (nitro.options.features?.websocket) {
    nitro.logger.warn(
      "[neon] WebSockets are not supported by the `neon` preset yet. Upgrade requests are handled as regular HTTP requests."
    );
  }
  if (!nitro.options.experimental.database) {
    return;
  }
  for (const [name, connection] of Object.entries(nitro.options.database || {})) {
    if (/sqlite/.test(String(connection?.connector))) {
      nitro.logger.warn(
        `[neon] Database \`${name}\` uses the \`${connection!.connector}\` connector. Neon Functions have a read-only filesystem outside \`/tmp\`, and \`/tmp\` is per isolate and lost on eviction. Remove the connection to use the branch Postgres.`
      );
    }
  }
}

export async function writeNeonOutput(nitro: Nitro) {
  const { dir, serverDir, publicDir } = nitro.options.output;
  for (const [option, path] of [
    ["output.serverDir", serverDir],
    ["output.publicDir", publicDir],
  ] as const) {
    if (relative(dir, path).startsWith("..")) {
      nitro.logger.warn(
        `[neon] \`${option}\` (\`${path}\`) is outside \`output.dir\` (\`${dir}\`), so it is not part of the deployed function.`
      );
    }
  }

  // Neon Functions load `index.mjs` from the root of the deployed directory. When the server
  // entry is already there, it is the handler itself.
  const entry = relative(dir, resolve(serverDir, "index.mjs"));
  if (entry !== "index.mjs") {
    await writeFile(resolve(dir, "index.mjs"), `export { default } from "./${entry}";\n`);
  }

  const triggers = Object.entries(nitro.options.scheduledTasks || {}).map(([cron, tasks]) => {
    if (!/^(\S+\s+){4}\S+$/.test(cron.trim()) || /[a-z@?#]/i.test(cron)) {
      nitro.logger.warn(
        `[neon] Scheduled task cron \`${cron}\` is not a five-field numeric expression, which Neon Function Triggers require.`
      );
    }
    return {
      cron,
      functionPath: CRON_PATH_PREFIX + Buffer.from(cron).toString("base64url"),
      tasks: Array.isArray(tasks) ? tasks : [tasks],
    };
  });
  await writeFile(resolve(dir, "neon.json"), JSON.stringify({ triggers }, null, 2) + "\n");

  if (triggers.length > 0) {
    nitro.logger.info(
      `[neon] Create a schedule trigger for each cron, using the \`functionPath\` from \`${relative(nitro.options.rootDir, resolve(dir, "neon.json"))}\`.`
    );
  }
}
