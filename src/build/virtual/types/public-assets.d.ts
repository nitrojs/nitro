export const publicAssetBases: string[];
export const isPublicAssetURL: (id: string) => boolean;
export const getPublicAssetMeta: (id: string) => { maxAge?: number };
export const readAsset: (id: string) => Promise<Buffer>;
export const getAsset: (id: string) => PublicAsset;
