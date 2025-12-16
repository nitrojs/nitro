export interface PublicAsset {
  type: string;
  etag: string;
  mtime: string;
  path: string;
  size: number;
  encoding?: string | null;
  data?: string;
}

export interface AssetMeta {
  type?: string;
  etag?: string;
  mtime?: string;
}
