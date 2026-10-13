// https://docs.netlify.com/build/frameworks/frameworks-api/

export interface NetlifyOptions {
  /** @deprecated Use `config.images` */
  images?: NetlifyImagesConfig;
  config?: NetlifyConfigJson;
  // skewProtection?: NetlifySkewProtectionJson;
  // edgeFunctionsImportMap?: NetlifyImportMapJson;
  // blobsMetadata?: Record<string, NetlifyBlobMetadata>;
}

export interface NetlifyConfigJson {
  edge_functions?: NetlifyEdgeFunctionDeclaration[];
  functions?: NetlifyFunctionsConfig | NetlifyFunctionsConfigByPattern;
  headers?: NetlifyHeaderRule[];
  images?: NetlifyImagesConfig;
  redirects?: NetlifyRedirectRule[];
  "redirects!"?: NetlifyRedirectRule[];
}

interface NetlifyEdgeFunctionDeclaration {
  function: string;
  path?: string;
  pattern?: string;
  excludedPath?: string;
  excludedPattern?: string;
  cache?: string;
  [key: string]: unknown;
}

interface NetlifyFunctionsConfig extends NetlifyFunctionInlineConfig {
  directory?: string;
}

export type NetlifyFunctionsConfigByPattern = Record<string, NetlifyFunctionInlineConfig>;

interface NetlifyFunctionInlineConfig {
  included_files?: string[];
  [key: string]: unknown;
}

interface NetlifyHeaderRule {
  for: string;
  values: Record<string, string>;
  [key: string]: unknown;
}

interface NetlifyImagesConfig {
  remote_images?: string[];
  [key: string]: unknown;
}

interface NetlifyRedirectRule {
  from: string;
  to: string;
  status?: number;
  force?: boolean;
  conditions?: Record<string, string[]>;
  query?: Record<string, string>;
  [key: string]: unknown;
}

export interface NetlifySkewProtectionJson {
  patterns: string[];
  sources: NetlifySkewProtectionSource[];
  [key: string]: unknown;
}

interface NetlifySkewProtectionSource {
  type: "cookie" | "header" | "query";
  name: string;
  [key: string]: unknown;
}

export interface NetlifyImportMapJson {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

export interface NetlifyBlobMetadata {
  headers?: Record<string, string>;
  [key: string]: unknown;
}
