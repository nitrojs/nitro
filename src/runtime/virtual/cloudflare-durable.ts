import "./_runtime_warn.ts";
import type { CloudflareDurableResolver } from "nitro/types";

export const bindingName = "$DurableObject";
export const instanceName = "server";
export const resolveInstanceName: CloudflareDurableResolver | undefined =
  undefined;
