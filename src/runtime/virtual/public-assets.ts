import "./_runtime_warn.ts";
import type { PublicAsset } from "nitro/types";

export const publicAssetBases: string[] = [];

export const isPublicAssetURL: (id: string) => boolean = () => false;

export const getPublicAssetMeta: (id: string) => { maxAge?: number } | null = () => null;

export const readAsset: (id: string) => Promise<Buffer> = async () => {
  throw new Error("Asset not found");
};

export const getAsset: (id: string) => PublicAsset | null = () => null;
