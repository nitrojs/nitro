import "./_runtime_warn.ts";

export const readAsset: (
  id: string,
  range?: { start: number; end: number }
) => Promise<Buffer | Uint8Array | null | undefined> = async () => null;
