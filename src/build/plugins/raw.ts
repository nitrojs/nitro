import { promises as fsp } from "node:fs";
import mime from "mime";
import type { Plugin } from "rollup";

const HELPER_ID = "virtual:nitro-raw-helpers";
const RESOLVED_PREFIX = "virtual:nitro:raw:";
const PREFIX = "raw:";

export function raw(): Plugin {
  return {
    name: "nitro:raw",
    resolveId: {
      order: "pre",
      filter: {
        id: [new RegExp(`^${HELPER_ID}$`), new RegExp(`^${PREFIX}`)],
      },
      async handler(id, importer, resolveOpts) {
        if (id === HELPER_ID) {
          return id;
        }
        if (id.startsWith(PREFIX)) {
          const resolvedId = (await this.resolve(id.slice(PREFIX.length), importer, resolveOpts))
            ?.id;
          if (!resolvedId) {
            return null;
          }
          return { id: RESOLVED_PREFIX + resolvedId };
        }
      },
    },
    load: {
      order: "pre",
      filter: {
        id: [new RegExp(`^${HELPER_ID}$`), new RegExp(`^${RESOLVED_PREFIX}`)],
      },
      handler(id) {
        if (id === HELPER_ID) {
          return getHelpers();
        }
        if (id.startsWith(RESOLVED_PREFIX)) {
          // this.addWatchFile(id.substring(RESOLVED_PREFIX.length));
          return fsp.readFile(id.slice(RESOLVED_PREFIX.length), isBinary(id) ? "binary" : "utf8");
        }
      },
    },
    transform: {
      order: "pre",
      filter: {
        id: new RegExp(`^${RESOLVED_PREFIX}`),
      },
      handler(code, id) {
        const path = id.slice(RESOLVED_PREFIX.length);
        if (isBinary(id)) {
          const serialized = Buffer.from(code, "binary").toString("base64");
          return {
            code: `import {base64ToUint8Array } from "${HELPER_ID}" \n export default base64ToUint8Array("${serialized}")`,
            map: rawAssetMap(path),
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
