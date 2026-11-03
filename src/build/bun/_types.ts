// Subset of the `Bun.build` types used by the `bun` builder (https://bun.com/docs/bundler).
// `bun-types` is not used: it declares runtime globals conflicting with the Node.js types.

export type BunLoader = "js" | "jsx" | "ts" | "tsx" | "json" | "text" | "css" | (string & {});

export interface BunPluginBuilder {
  onResolve(
    constraints: { filter: RegExp; namespace?: string },
    callback: (args: {
      path: string;
      importer: string;
      namespace: string;
      resolveDir: string;
      kind: string;
    }) => BunMaybePromise<{ path: string; namespace?: string; external?: boolean } | undefined>
  ): unknown;
  onLoad(
    constraints: { filter: RegExp; namespace?: string },
    callback: (args: {
      path: string;
      namespace: string;
      loader: BunLoader;
    }) => BunMaybePromise<{ contents: string | Uint8Array; loader?: BunLoader } | undefined>
  ): unknown;
}

export interface BunPlugin {
  name: string;
  setup: (build: BunPluginBuilder) => void | Promise<void>;
}

export interface BunBuildMessage {
  message: string;
  level: string;
  position: { file: string; line: number; column: number } | null;
}

export interface BunBuildArtifact {
  path: string;
  kind: "entry-point" | "chunk" | "asset" | "sourcemap" | "bytecode";
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
}

export interface BunBuildOutput {
  success: boolean;
  outputs: BunBuildArtifact[];
  logs: BunBuildMessage[];
  metafile?: {
    inputs: Record<string, unknown>;
    outputs: Record<string, BunMetafileOutput>;
  };
}

export interface BunMetafileOutput {
  inputs: Record<string, unknown>;
  imports?: { path: string; kind: string; external?: boolean }[];
  exports?: string[];
  entryPoint?: string;
}

type BunMaybePromise<T> = T | Promise<T>;
