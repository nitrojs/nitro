import type { Nitro } from "./nitro.ts";

export type NitroModuleInput = string | NitroModule | NitroModule["setup"];

export interface NitroModule {
  name?: string;
  setup: (this: void, nitro: Nitro) => void | Promise<void>;
}
