import assets from "#nitro/virtual/public-assets-data";

type Source = { data?: string; _data?: Uint8Array };

/** Reads a public asset inlined (base64) into the manifest, without a promise. */
export function readAsset(
  id: string,
  { encoding }: { encoding?: string } = {}
): Uint8Array | undefined {
  const entry = (assets as Record<string, Source & { variants?: Record<string, Source> }>)[id];
  const source = encoding ? entry?.variants?.[encoding] : entry;
  if (source?.data !== undefined) {
    return (source._data ??= Uint8Array.from(atob(source.data), (c) => c.charCodeAt(0)));
  }
}
