import type { Nitro } from "nitro/types";
import type { H3Event } from "h3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "pathe";
import { withoutTrailingSlash } from "ufo";
import { isLocalDevRequest } from "./_request.ts";

/**
 * Chrome DevTools project settings endpoint, used for automatic workspace folders.
 *
 * @see https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md
 */
export const DEVTOOLS_JSON_ROUTE = "/.well-known/appspecific/com.chrome.devtools.json";

export function createDevToolsJSONHandler(nitro: Nitro) {
  let uuid: Promise<string> | undefined;
  return async (event: H3Event) => {
    const rootDir = withoutTrailingSlash(nitro.options.rootDir);
    return {
      workspace: {
        // Avoid exposing the absolute project path to other hosts
        root: isLocalDevRequest(event) ? toDevToolsPath(rootDir) : basename(rootDir),
        uuid: await (uuid ??= getWorkspaceUUID(nitro)),
      },
    };
  };
}

async function getWorkspaceUUID(nitro: Nitro): Promise<string> {
  const uuidFile = join(nitro.options.buildDir, "devtools-uuid");
  const cached = await readFile(uuidFile, "utf8").then(
    (contents) => contents.trim(),
    () => ""
  );
  if (UUID_RE.test(cached)) {
    return cached;
  }
  const uuid = randomUUID();
  try {
    await mkdir(dirname(uuidFile), { recursive: true });
    await writeFile(uuidFile, uuid, "utf8");
  } catch (error) {
    nitro.logger.warn(
      `Failed to persist Chrome DevTools workspace UUID to \`${uuidFile}\`:`,
      error
    );
  }
  return uuid;
}

// Chrome running on Windows can only mount WSL and Docker Desktop folders through their UNC paths.
function toDevToolsPath(path: string): string {
  const distro =
    process.env.WSL_DISTRO_NAME || (process.env.DOCKER_DESKTOP ? "docker-desktop-data" : "");
  if (distro && path.startsWith("/")) {
    return `\\\\wsl.localhost\\${distro}${path.replaceAll("/", "\\")}`;
  }
  return process.platform === "win32" ? path.replaceAll("/", "\\") : path;
}

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
