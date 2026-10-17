const denoSpecifierRE = /^(?:https:\/\/|npm:|jsr:)/;

/**
 * Whether a module specifier is resolved by a Deno-based runtime itself
 * (Deno, Deno Deploy, Bunny Edge Scripting) rather than by the bundler.
 *
 * These carry their own source and version, so they must be externalized:
 * bundling them is impossible and failing to resolve them breaks the build.
 */
export function isDenoSpecifier(id: string): boolean {
  return denoSpecifierRE.test(id);
}
