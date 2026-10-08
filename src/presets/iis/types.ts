export interface IisOptions {
  /** Merge with existing IIS `web.config` instead of replacing. */
  mergeConfig?: boolean;
  /** Override existing IIS `web.config` entirely. */
  overrideConfig?: boolean;
}
