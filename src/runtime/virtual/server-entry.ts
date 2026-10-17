import "./_runtime_warn.ts";
import type { NitroServerEntry } from "nitro/types";

export const serverEntryOptions: Omit<NitroServerEntry, "fetch"> = {};

export const serverEntryExports: Record<string, unknown> = {};
