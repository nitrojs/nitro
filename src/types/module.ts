import type { Nitro } from "./nitro.ts";

/**
 * Accepted input formats for Nitro modules.
 *
 * Can be a module path string, a {@link NitroModule} object, a bare setup
 * function, or an object with a `nitro` key containing a {@link NitroModule}.
 *
 * @see https://nitro.build/config#modules
 */
export type NitroModuleInput = string | NitroModule | NitroModule["setup"] | { nitro: NitroModule };

/**
 * A Nitro module that extends behavior during initialization.
 *
 * Modules receive the {@link Nitro} instance and can register hooks,
 * add handlers, modify options, or perform other setup tasks.
 *
 * @example
 * ```ts
 * export default {
 *   name: "my-module",
 *   nitro: {
 *     setup(nitro) {
 *       nitro.hooks.hook("compiled", () => {
 *         console.log("Build complete!");
 *       });
 *     },
 *   },
 * };
 * ```
 *
 * @see https://nitro.build/config#modules
 */
export interface NitroModule {
  name?: string;
  setup: (this: void, nitro: Nitro) => void | Promise<void>;
}
