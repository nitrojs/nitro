import { createDefu } from "defu";
import { mergeHooks } from "hookable";

/**
 * Deep merge Nitro configs like `defu` (first source has the highest priority), but run hooks
 * with the same name from all sources (lowest priority first) instead of overriding each other.
 */
export const mergeConfig = createDefu(mergeConfigHooks) as (...sources: any[]) => any;

export function mergeConfigHooks(
  obj: any,
  key: PropertyKey,
  value: any,
  namespace: string
): boolean {
  if (key === "hooks" && !namespace && isObject(obj.hooks) && isObject(value)) {
    obj.hooks = mergeHooks(obj.hooks, value);
    return true;
  }
  return false;
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
