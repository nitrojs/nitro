import type { DateString } from "compatx";
import type { ProviderName } from "std-env";
import type { NitroConfig } from "./config";

export type NitroPreset = NitroConfig | (() => NitroConfig);

export interface NitroPresetMeta {
  name: string;
  stdName?: ProviderName;
  aliases?: string[];
  static?: boolean;
  dev?: boolean;
  compatibilityDate?: DateString;
}

export type {
  PresetName,
  PresetNameInput,
  PresetOptions,
} from "../presets/_types.gen";
