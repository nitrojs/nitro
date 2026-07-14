import { promises as fsp } from "node:fs";
import mime from "mime";
import type { Plugin } from "rollup";

const HELPER_ID = "virtual:nitro-raw-helpers";

// `raw:` infers the module type from the file mime, `bytes:` always yields a
// Uint8Array and `text:` always a string (import attributes ignore the file type)
const TYPES = ["raw", "bytes", "text"] as const;

const PREFIX_RE = new RegExp(`^(${TYPES.join("|")}):`);

// Modules under this prefix hold file contents, not source code, so other transforms must skip them
export const RESOLVED_RE = new RegExp(`^virtual:nitro:(${TYPES.join("|")}):`);

// Resolved ids are JavaScript modules. Without this, plugins matching the original
// extension (`@rollup/plugin-json`, vite's json plugin, ...) try to transform them again.
const RESOLVED_SUFFIX = ".js";

export function raw(): Plugin {
  return {
    name: "nitro:raw",
    resolveId: {
      order: "pre",
      filter: {
        id: [new RegExp(`^${HELPER_ID}$`), PREFIX_RE],
      },
      async handler(id, importer, resolveOpts) {
        if (id === HELPER_ID) {
          return id;
        }
        const type = PREFIX_RE.exec(id)?.[1];
        if (!type) {
          return;
        }
        const specifier = id.slice(type.length + 1);
        const resolved = await this.resolve(specifier, importer, resolveOpts);
        // The `load` hook reads the file from disk, so anything that is not a plain
        // path (unresolved, external or carrying a query) cannot be inlined
        if (!resolved?.id || resolved.external || resolved.id.includes("?")) {
          return this.error(
            `Could not resolve \`${specifier}\`${importer ? ` (imported by \`${importer}\`)` : ""} to a file on disk to inline it as \`${type}\`.`
          );
        }
        return { id: `virtual:nitro:${type}:${resolved.id}${RESOLVED_SUFFIX}` };
      },
    },
    load: {
      order: "pre",
      filter: {
        id: [new RegExp(`^${HELPER_ID}$`), RESOLVED_RE],
      },
      handler(id) {
        if (id === HELPER_ID) {
          return getHelpers();
        }
        const parsed = parseRawId(id);
        if (!parsed) {
          return; // In case the builder does not support filters
        }
        const { path, binary } = parsed;
        this.addWatchFile(path);
        return fsp.readFile(path, binary ? "binary" : "utf8");
      },
    },
    transform: {
      order: "pre",
      filter: {
        id: RESOLVED_RE,
      },
      handler(code, id) {
        const parsed = parseRawId(id);
        if (!parsed) {
          return; // In case the builder does not support filters
        }
        const { path, binary } = parsed;
        if (binary) {
          const serialized = Buffer.from(code, "binary").toString("base64");
          return {
            code: `import {base64ToUint8Array } from "${HELPER_ID}" \n export default base64ToUint8Array("${serialized}")`,
            map: rawAssetMap(path),
            moduleType: "js",
          };
        }
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: rawAssetMap(path),
          moduleType: "js",
        };
      },
    },
  };
}

function parseRawId(id: string) {
  const match = RESOLVED_RE.exec(id);
  if (!match) {
    return;
  }
  const [, type] = match;
  const path = id.replace(RESOLVED_RE, "").slice(0, -RESOLVED_SUFFIX.length);
  return { path, binary: type === "raw" ? isBinary(path) : type === "bytes" };
}

function isBinary(id: string) {
  const idMime = mime.getType(id) || "";
  if (idMime.startsWith("text/")) {
    return false;
  }
  if (/application\/(json|sql|xml|yaml)/.test(idMime)) {
    return false;
  }
  return true;
}

function getHelpers() {
  return /* js */ `
export function base64ToUint8Array(str) {
  const data = atob(str);
  const size = data.length;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = data.charCodeAt(i);
  }
  return bytes;
}
  `;
}

function rawAssetMap(id: string) {
  return {
    version: 3,
    file: id,
    sources: [id],
    sourcesContent: [],
    names: [],
    mappings: "",
  };
}
