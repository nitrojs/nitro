import "./_runtime_warn.ts";
import type { CloudflareDurableResolver } from "nitro/presets/cloudflare";

export const bindingName = "$DurableObject";
export const instanceName = "server";
export const resolveInstanceName: CloudflareDurableResolver | undefined = undefined;
