import _replace from "@rollup/plugin-replace";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type { Plugin } from "rollup";

const NO_REPLACE_RE = /ROLLUP_NO_REPLACE|\\0raw:/;

export function replace(options: RollupReplaceOptions): Plugin {
  const _plugin = (_replace as unknown as typeof _replace.default)(options);
  return {
    ..._plugin,
    // https://github.com/rollup/plugins/blob/master/packages/replace/src/index.js#L94
    renderChunk(code, chunk, options) {
      if (!NO_REPLACE_RE.test(code)) {
        // prettier-ignore
        // @ts-ignore
        return (_plugin.renderChunk as () => any).call(this, code, chunk, options );
      }
    },
  };
}
