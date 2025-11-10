import { promises as fsp } from "node:fs";
import mime from "mime";
import type { Plugin } from "rollup";

const HELPER_ID = "virtual:raw-helpers";
const RESOLVED_RAW_PREFIX = "virtual:raw:";

export function raw(): Plugin {
  return {
    name: "raw",
    resolveId: {
      order: "pre",
      async handler(id, importer, resolveOpts) {
        if (id === HELPER_ID) {
          return id;
        }
        if (id.startsWith("raw:")) {
          const resolvedId = (
            await this.resolve(id.slice(4 /* raw: */), importer, resolveOpts)
          )?.id;
          return { id: RESOLVED_RAW_PREFIX + resolvedId };
        }
      },
    },
    load: {
      order: "pre",
      handler(id) {
        if (id === HELPER_ID) {
          return getHelpers();
        }
        if (id.startsWith(RESOLVED_RAW_PREFIX)) {
          // this.addWatchFile(id.substring(RESOLVED_RAW_PREFIX.length));
          return fsp.readFile(
            id.slice(RESOLVED_RAW_PREFIX.length),
            isBinary(id) ? "binary" : "utf8"
          );
        }
      },
    },
    transform: {
      order: "pre",
      handler(code, id) {
        if (!id.startsWith(RESOLVED_RAW_PREFIX)) {
          return;
        }
        if (isBinary(id)) {
          const serialized = Buffer.from(code, "binary").toString("base64");
          return {
            code: `import {base64ToUint8Array } from "${HELPER_ID}" \n export default base64ToUint8Array("${serialized}")`,
            map: null,
          };
        }
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null,
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
  const js = String.raw;
  return js`
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
