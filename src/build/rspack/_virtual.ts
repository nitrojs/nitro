import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "pathe";

/**
 * Maps resolved ids to Rspack requests. Ids that are not files (virtual modules) get an empty
 * placeholder file, which the pre-loader replaces with the result of the `load` hooks.
 */
export class VirtualPlaceholders {
  /** Directory of the placeholder files. */
  readonly dir: string;
  /** Virtual module ids by placeholder path. */
  readonly ids = new Map<string, string>();

  constructor(dir: string) {
    this.dir = dir;
  }

  /** Resolved id to request: absolute file paths as-is, others to a placeholder file. */
  toRequest(id: string): string {
    const path = id.split("?")[0];
    if (isAbsolute(path) && existsSync(path)) {
      return id;
    }
    const name = id.replace(/[^\w.-]+/g, "_").slice(-50);
    const hash = createHash("sha256").update(id).digest("hex").slice(0, 8);
    // TypeScript and JSX virtual modules keep their extension (compiled by the SWC loader)
    const ext = /\.(?:[cm]?tsx?|jsx)$/.exec(id)?.[0] || ".mjs";
    const placeholder = join(this.dir, `${hash}-${name}${ext}`);
    if (!this.ids.has(placeholder)) {
      this.ids.set(placeholder, id);
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(placeholder, "");
    }
    return placeholder;
  }

  /** Module resource (or issuer, native path) to its plugin id. */
  toId(resource: string): string {
    return this.ids.get(normalize(resource)) ?? resource;
  }

  /** Whether a module resource (or issuer) is a virtual module. */
  isVirtual(resource: string): boolean {
    return this.ids.has(normalize(resource));
  }
}
