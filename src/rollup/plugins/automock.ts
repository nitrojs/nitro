import { consola } from "consola";

const internalRegex = /^\.|\?|\.[cm]?js$|.ts$|.json$/;

export function autoMock() {
  return {
    name: "auto-mock",
    resolveId(src: string) {
      if (src && !internalRegex.test(src)) {
        consola.warn("Auto mock external ", src);
        return {
          id: "unenv/mock/proxy-cjs",
        };
      }
      return null;
    },
  };
}
