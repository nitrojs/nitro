import type { Config } from "automd";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, extname, relative } from "pathe";

interface FileEntry {
  path: string;
  relativePath: string;
  content: string;
  language: string;
}

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".DS_Store",
  ".nuxt",
  ".output",
  ".nitro",
  "dist",
  "coverage",
  ".cache",
  ".turbo",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
];

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
  ".vue": "vue",
  ".json": "json",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".md": "md",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
};

async function parseGitignore(dir: string): Promise<string[]> {
  try {
    const gitignorePath = join(dir, ".gitignore");
    const content = await readFile(gitignorePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function shouldIgnore(name: string, ignorePatterns: string[], defaultIgnore: string[]): boolean {
  const allPatterns = [...defaultIgnore, ...ignorePatterns];
  for (const pattern of allPatterns) {
    const cleanPattern = pattern.replace(/^\//, "").replace(/\/$/, "");
    if (name === cleanPattern) {
      return true;
    }
    if (pattern.startsWith("*") && name.endsWith(pattern.slice(1))) {
      return true;
    }
    if (pattern.endsWith("*") && name.startsWith(pattern.slice(0, -1))) {
      return true;
    }
  }
  return false;
}

function getLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || "text";
}

async function collectFiles(
  dir: string,
  baseDir: string,
  ignorePatterns: string[],
  maxDepth: number,
  currentDepth: number = 0
): Promise<FileEntry[]> {
  if (maxDepth > 0 && currentDepth >= maxDepth) {
    return [];
  }

  const entries = await readdir(dir);
  const files: FileEntry[] = [];

  for (const entry of entries) {
    if (shouldIgnore(entry, ignorePatterns, DEFAULT_IGNORE)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      const nestedFiles = await collectFiles(
        fullPath,
        baseDir,
        ignorePatterns,
        maxDepth,
        currentDepth + 1
      );
      files.push(...nestedFiles);
    } else {
      try {
        const content = await readFile(fullPath, "utf8");
        const relativePath = relative(baseDir, fullPath);
        files.push({
          path: fullPath,
          relativePath,
          content: content.trim(),
          language: getLanguage(fullPath),
        });
      } catch {
        // Skip binary or unreadable files
      }
    }
  }

  return files;
}

function sortFiles(files: FileEntry[]): FileEntry[] {
  return files.sort((a, b) => {
    const aParts = a.relativePath.split("/");
    const bParts = b.relativePath.split("/");

    // Sort by depth first (shallower files first)
    if (aParts.length !== bParts.length) {
      return aParts.length - bParts.length;
    }

    // Then alphabetically
    return a.relativePath.localeCompare(b.relativePath);
  });
}

function generateCodeTree(
  files: FileEntry[],
  options: { defaultValue?: string; expandAll?: boolean } = {}
): string {
  const sortedFiles = sortFiles(files);
  const codeBlocks: string[] = [];

  for (const file of sortedFiles) {
    const lang = file.language;
    const filename = file.relativePath;

    // Use 4 backticks for markdown files to avoid conflicts
    const fence = lang === "md" ? "````" : "```";
    codeBlocks.push(`${fence}${lang} [${filename}]`);
    codeBlocks.push(file.content);
    codeBlocks.push(fence);
    codeBlocks.push("");
  }

  const attrs: string[] = [];
  if (options.defaultValue) {
    attrs.push(`defaultValue="${options.defaultValue}"`);
  }
  if (options.expandAll) {
    attrs.push(`expandAll`);
  }
  const propsStr = attrs.length > 0 ? `{${attrs.join(" ")}}` : "";
  const contents = `::code-tree${propsStr}\n\n${codeBlocks.join("\n").trim()}\n\n::`;

  return contents;
}

function resolvePath(srcPath: string, options: { url?: string; dir?: string }): string {
  if (srcPath.startsWith("/")) {
    return srcPath;
  }
  const base = options.url ? new URL(".", options.url).pathname : options.dir || process.cwd();
  return join(base, srcPath);
}

export default {
  input: ["README.md", "docs/**/*.md"],
  generators: {
    compatDate: {
      name: "compatDate",
      async generate(ctx) {
        // const { compatibilityChanges } = await import("./lib/meta.mjs");

        // const table = [
        //   "| Compatibility date | Platform | Description |",
        //   "|------|----------|-------------|",
        //   ...compatibilityChanges.map(
        //     (change) =>
        //       `| **≥ ${change.from}** | ${change.platform} | ${change.description} |`
        //   ),
        // ];
        return {
          // contents: table.join("\n"),
          contents: "",
        };
      },
    },
    "ui-code-tree": {
      name: "ui-code-tree",
      async generate({
        args,
        config,
        url,
      }: {
        args: Record<string, unknown>;
        config: { dir?: string };
        url?: string;
      }) {
        const srcPath = (args.src as string) || ".";
        const fullPath = resolvePath(srcPath, { url, dir: config.dir });

        const stats = await stat(fullPath);
        if (!stats.isDirectory()) {
          throw new Error(`Path "${srcPath}" is not a directory`);
        }

        const userIgnore: string[] = args.ignore
          ? String(args.ignore)
              .split(",")
              .map((s: string) => s.trim())
          : [];

        const gitignorePatterns = await parseGitignore(fullPath);
        const ignorePatterns = [...gitignorePatterns, ...userIgnore];

        const maxDepth = args.maxDepth ? Number(args.maxDepth) : 0;
        const defaultValue = (args.defaultValue || args.default) as string | undefined;
        const expandAll = args.expandAll !== undefined && args.expandAll !== "false";

        const files = await collectFiles(fullPath, fullPath, ignorePatterns, maxDepth);

        if (files.length === 0) {
          return {
            contents: "<!-- No files found -->",
            issues: ["No files found in the specified directory"],
          };
        }

        const contents = generateCodeTree(files, { defaultValue, expandAll });

        return { contents };
      },
    },
  },
} satisfies Config;
