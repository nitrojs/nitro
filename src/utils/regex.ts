import { isWindows } from "std-env";

export function escapeRegExp(string: string): string {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
}

export function pathRegExp(string: string): string {
  if (isWindows) {
    string = string.replace(/\\/g, "/");
  }
  let escaped = escapeRegExp(string);
  if (isWindows) {
    escaped = escaped.replace(/\//g, String.raw`[/\\]`);
  }
  return escaped;
}

export function toPathRegExp(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input;
  }
  if (typeof input === "string") {
    return new RegExp(pathRegExp(input));
  }
  throw new TypeError("Expected a string or RegExp", { cause: input });
}
