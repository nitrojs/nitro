import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { builtinModules, createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, relative, resolve } from "pathe";
import { parseSync } from "rolldown/utils";

type Node = Record<string, any>;

export async function inspectTransportedOutput(root: string) {
  const visited = new Set<string>();
  async function inside(path: string) {
    const target = await realpath(path);
    const rel = relative(root, target);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith("../")) {
      throw new Error(`A production artifact escapes its output directory: ${path}`);
    }
    return target;
  }
  async function walk(path: string) {
    const target = await inside(path);
    if (visited.has(target)) return;
    visited.add(target);
    const stat = await lstat(target);
    if (stat.isDirectory()) {
      for (const name of await readdir(target)) await walk(join(target, name));
      return;
    }
    if (!target.endsWith(".mjs")) return;
    const code = await readFile(target, "utf8");
    const specifiers: string[] = [];
    const parsed = parseSync(target, code, { sourceType: "module" });
    if (parsed.errors.length) throw new Error(`Could not inspect a production module: ${target}`);
    visit(parsed.program as Node, (node) => {
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
          "ImportExpression",
        ].includes(node.type) &&
        typeof node.source?.value === "string"
      ) {
        specifiers.push(node.source.value);
      }
      if (
        node.type === "CallExpression" &&
        node.callee?.name === "require" &&
        typeof node.arguments?.[0]?.value === "string"
      ) {
        specifiers.push(node.arguments[0].value);
      }
    });
    for (const id of specifiers) {
      if (id.startsWith("node:") || builtinModules.includes(id) || id.startsWith("data:")) continue;
      const resolved = id.startsWith("file:")
        ? fileURLToPath(id)
        : id.startsWith(".") || isAbsolute(id)
          ? resolve(dirname(target), id)
          : createRequire(target).resolve(id);
      await inside(resolved);
    }
  }
  await walk(root);
}

export async function fileManifest(dir: string) {
  const manifest: Record<string, string> = {};
  for (const path of await allFiles(dir)) {
    manifest[relative(dir, path)] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  }
  return manifest;
}

export async function allFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...(await allFiles(path)));
    else files.push(path);
  }
  return files.map((path) => path.replaceAll("\\", "/"));
}

function visit(node: Node, fn: (node: Node) => void) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") fn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) visit(child, fn);
    else if (value && typeof value === "object") visit(value, fn);
  }
}
