export function escapeRegExp(string: string): string {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
}
