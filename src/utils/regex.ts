export function escapeRegExp(string: string): string {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
}

export function toRegExp(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input;
  }
  if (typeof input === "string") {
    return new RegExp(escapeRegExp(input));
  }
  throw new TypeError("Expected a string or RegExp", { cause: input });
}
