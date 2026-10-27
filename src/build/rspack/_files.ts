import { createHash } from "node:crypto";
import { basename, extname } from "pathe";

export type AssetSource = string | Uint8Array;

/** `this.emitFile` argument (Rollup `EmittedFile`). */
export interface EmittedFile {
  type: string;
  name?: string;
  fileName?: string;
  originalFileName?: string | null;
  source?: AssetSource;
}

/** Files emitted by the plugins (`this.emitFile`), by reference id (`this.getFileName`). */
export class EmittedFiles {
  readonly fileNames = new Map<string, string>();

  /** Emits an asset (chunks are not supported) and returns its reference id. */
  emit(file: EmittedFile, emitAsset: (fileName: string, source: AssetSource) => void): string {
    if (file.type !== "asset") {
      throw new Error(
        `\`this.emitFile\` only supports \`type: "asset"\` with the \`rspack\` builder (got \`${file.type}\`).`
      );
    }
    if (file.source == null) {
      throw new Error(
        "`this.emitFile` requires a `source` with the `rspack` builder (`this.setAssetSource` is not supported)."
      );
    }
    const fileName = file.fileName || assetFileName(file, file.source);
    const referenceId = hash(fileName);
    this.fileNames.set(referenceId, fileName);
    emitAsset(fileName, file.source);
    return referenceId;
  }

  getFileName(referenceId: string): string {
    const fileName = this.fileNames.get(referenceId);
    if (!fileName) {
      throw new Error(`Unknown file reference id \`${referenceId}\`.`);
    }
    return fileName;
  }
}

/** Like the `_assets/[name]-[hash][ext]` file names of Rspack asset modules. */
function assetFileName(file: EmittedFile, source: AssetSource): string {
  const name = basename(file.name || file.originalFileName || "asset");
  const ext = extname(name);
  return `_assets/${name.slice(0, name.length - ext.length)}-${hash(source)}${ext}`;
}

function hash(data: AssetSource): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 8);
}
