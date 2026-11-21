export interface PublicAsset {
  type: string;
  etag: string;
  mtime: string;
  path: string;
  size: number;
  encoding?: string;
  data?: string;
  /**
   * Compressed copies of the file (at `path` with their extension), by encoding.
   *
   * Entries of the build manifest without a plain file only have `type`, `path` and `variants`.
   */
  variants?: Record<string, PublicAssetVariant>;
}

export interface PublicAssetVariant {
  etag: string;
  size: number;
  /** Only set when the asset has no plain file: variants share its `mtime` */
  mtime?: string;
  data?: string;
}

export interface AssetMeta {
  type?: string;
  etag?: string;
  mtime?: string;
}
