// Resolved by the Deno runtime, not the bundler. This fixture is only ever
// built, never executed, so the packages are not installed locally.
// @ts-expect-error -- `jsr:` is not resolvable by TypeScript
import { encodeHex } from "jsr:@std/encoding@1/hex";
// @ts-expect-error -- `npm:` is not resolvable by TypeScript
import { escape } from "npm:lodash-es@4.17.21";

export default {
  fetch(_req: Request) {
    return new Response(`${typeof encodeHex} ${typeof escape}`);
  },
};
