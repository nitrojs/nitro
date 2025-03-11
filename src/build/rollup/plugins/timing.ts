import { extname } from "pathe";
import type { Plugin, RenderedChunk } from "rollup";

interface TimingOptions {
  silent?: boolean;
}

const TIMING = "globalThis.__timing__";

const iife = (code: string) =>
  `(function() { ${code.trim()} })();`.replace(/\n/g, "");

const HELPERIMPORT = "import './timing.js';";

export function timing(opts: TimingOptions = {}): Plugin {
  const HELPER_DEBUG = opts.silent
    ? ""
    : `if (t > 0) { console.debug('>', id + ' (' + t + 'ms)'); }`;

  const HELPER = iife(/* js */ `
    const start = () => Date.now();
    const end = s => Date.now() - s;
    const _s = {};
    const metrics = [];
    const logStart = id => { _s[id] = Date.now(); };
    const logEnd = id => { const t = end(_s[id]); delete _s[id]; metrics.push([id, t]); ${HELPER_DEBUG} };
    ${TIMING} = { start, end, metrics, logStart, logEnd };
    `);

  return {
    name: "timing",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "timing.js",
        source: HELPER,
      });
    },
    renderChunk(code, chunk: RenderedChunk) {
      let name = chunk.fileName || "";
      name = name.replace(extname(name), "");
      const logName = name === "index" ? "Nitro Start" : "Load " + name;
      return {
        code:
          (chunk.isEntry ? HELPERIMPORT : "") +
          `${TIMING}.logStart('${logName}');` +
          code +
          `;${TIMING}.logEnd('${logName}');`,
        map: null,
      };
    },
  };
}
