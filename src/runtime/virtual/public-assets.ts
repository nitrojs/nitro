import "./_runtime_warn.ts";

export const isPublicAssetURL: (id: string) => boolean = () => false;

export const isPublicAssetBaseURL: (id: string) => boolean = () => false;

export const readAsset: (
  id: string,
  opts?: { encoding?: string; range?: { start: number; end: number } }
) => Promise<Buffer | ReadableStream<Uint8Array>> = async () => {
  throw new Error("Asset not found");
};
