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
        const resolvedId = (await this.resolve(id.slice(type.length + 1), importer, resolveOpts))
          ?.id;
        if (!resolvedId) {
          return null;
        }
        return { id: `virtual:nitro:${type}:${resolvedId}${RESOLVED_SUFFIX}` };
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
        const { path, binary } = parseRawId(id);
        // this.addWatchFile(path);
        return fsp.readFile(path, binary ? "binary" : "utf8");
      },
    },
    transform: {
      order: "pre",
      filter: {
        id: RESOLVED_RE,
      },
      handler(code, id) {
        const { path, binary } = parseRawId(id);
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
  const [, type] = RESOLVED_RE.exec(id)!;
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
