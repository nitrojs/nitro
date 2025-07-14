import { existsSync, promises as fsp } from "node:fs";
import { platform } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nodeFileTrace } from "@vercel/nft";
import {
  isValidNodeImport,
  lookupNodeModuleSubpath,
  normalizeid,
  parseNodeModulePath,
} from "mlly";
import { resolveModuleURL } from "exsolve";
import { isDirectory } from "nitropack/kit";
import type { NodeExternalsOptions } from "nitropack/types";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "pathe";
import type { PackageJson } from "pkg-types";
import { readPackageJSON, writePackageJSON } from "pkg-types";
import type { Plugin } from "rollup";
import semver from "semver";

export function externals(opts: NodeExternalsOptions): Plugin {
  const trackedExternals = new Set<string>();

  const tryResolve = (
    id: string,
    importer: undefined | string
  ): string | undefined => {
    if (id.startsWith("\0")) {
      return id;
    }
    const res = resolveModuleURL(id, {
      try: true,
      conditions: opts.exportConditions,
      from:
        importer && isAbsolute(importer)
          ? [pathToFileURL(importer), ...opts.moduleDirectories!]
          : opts.moduleDirectories,
      suffixes: ["", "/index"],
      extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts", ".json"],
    });
    return res?.startsWith("file://") ? fileURLToPath(res) : res;
  };

  // Normalize options
  const inlineMatchers = (opts.inline || [])
    .map((p) => normalizeMatcher(p))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const externalMatchers = (opts.external || [])
    .map((p) => normalizeMatcher(p))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Utility to check explicit inlines
  const isExplicitInline = (id: string, importer?: string) => {
    if (id.startsWith("\0")) {
      return true;
    }
    const inlineMatch = inlineMatchers.find((m) => m(id, importer));
    const externalMatch = externalMatchers.find((m) => m(id, importer));
    if (
      inlineMatch &&
      (!externalMatch ||
        (externalMatch &&
          (inlineMatch.score || 0) > (externalMatch.score || 0)))
    ) {
      return true;
    }
  };

  return {
    name: "node-externals",
    async resolveId(originalId, importer, options) {
      // Skip internals
      if (
        !originalId ||
        originalId.startsWith("\u0000") ||
        originalId.includes("?") ||
        originalId.startsWith("#")
      ) {
        return null;
      }

      // Skip relative paths
      if (originalId.startsWith(".")) {
        return null;
      }

      // Normalize path (windows)
      const id = normalize(originalId);

      // Check for explicit inlines and externals
      if (isExplicitInline(id, importer)) {
        return null;
      }

      // Resolve id using rollup resolver
      const resolved = (await this.resolve(originalId, importer, options)) || {
        id,
      };

      // Check for explicit inlines and externals
      if (isExplicitInline(resolved.id, importer)) {
        return null;
      }

      // Try resolving with Node.js algorithm as fallback
      if (
        !isAbsolute(resolved.id) ||
        !existsSync(resolved.id) ||
        (await isDirectory(resolved.id))
      ) {
        resolved.id = tryResolve(resolved.id, importer) || resolved.id;
      }

      // Inline invalid node imports
      if (!(await isValidNodeImport(resolved.id).catch(() => false))) {
        return null;
      }

      // Externalize with full path if trace is disabled
      if (opts.trace === false) {
        return {
          ...resolved,
          id: isAbsolute(resolved.id) ? normalizeid(resolved.id) : resolved.id,
          external: true,
        };
      }

      // -- Trace externals --

      // Try to extract package name from path
      const { name: pkgName } = parseNodeModulePath(resolved.id);

      // Inline if cannot detect package name
      if (!pkgName) {
        return null;
      }

      // Normally package name should be same as originalId
      // Edge cases: Subpath export and full paths
      if (pkgName !== originalId) {
        // Subpath export
        if (!isAbsolute(originalId)) {
          const fullPath = tryResolve(originalId, importer);
          if (fullPath) {
            trackedExternals.add(fullPath);
            return {
              id: originalId,
              external: true,
            };
          }
        }

        // Absolute path, we are not sure about subpath to generate import statement
        // Guess as main subpath export
        const packageEntry = tryResolve(pkgName, importer);
        if (packageEntry !== id) {
          // Reverse engineer subpath export
          const guessedSubpath: string | null | undefined =
            await lookupNodeModuleSubpath(id).catch(() => null);
          const resolvedGuess =
            guessedSubpath &&
            tryResolve(join(pkgName, guessedSubpath), importer);
          if (resolvedGuess === id) {
            trackedExternals.add(resolvedGuess);
            return {
              id: join(pkgName, guessedSubpath!),
              external: true,
            };
          }
          // Inline since we cannot guess subpath
          return null;
        }
      }

      trackedExternals.add(resolved.id);
      return {
        id: pkgName,
        external: true,
      };
    },
    async buildEnd() {
      if (opts.trace === false) {
        return;
      }

      // Manually traced paths
      for (const pkgName of opts.traceInclude || []) {
        const path = await this.resolve(pkgName);
        if (path?.id) {
          trackedExternals.add(path.id.replace(/\?.+/, ""));
        }
      }

      // Trace used files using nft
      const _fileTrace = await nodeFileTrace([...trackedExternals], {
        // https://github.com/nitrojs/nitro/pull/1562
        conditions: (opts.exportConditions || []).filter(
          (c) => !["require", "import", "default"].includes(c)
        ),
        ...opts.traceOptions,
      });

      // Resolve traced files
      type TracedFile = {
        path: string;
        subpath: string;
        parents: string[];

        pkgPath: string;
        pkgName: string;
        pkgVersion: string;
      };
      const _resolveTracedPath = (p: string) =>
        fsp.realpath(resolve(opts.traceOptions?.base || ".", p));
      const tracedFiles: Record<string, TracedFile> = Object.fromEntries(
        (await Promise.all(
          [..._fileTrace.reasons.entries()].map(async ([_path, reasons]) => {
            if (reasons.ignored) {
              return;
            }
            const path = await _resolveTracedPath(_path);
            if (!path.includes("node_modules")) {
              return;
            }
            if (!(await isFile(path))) {
              return;
            }
            const {
              dir: baseDir,
              name: pkgName,
              subpath,
            } = parseNodeModulePath(path);
            if (!baseDir || !pkgName) {
              return;
            }
            const pkgPath = join(baseDir, pkgName);
            const parents = await Promise.all(
              [...reasons.parents].map((p) => _resolveTracedPath(p))
            );
            const tracedFile = <TracedFile>{
              path,
              parents,

              subpath,
              pkgName,
              pkgPath,
            };
            return [path, tracedFile];
          })
        ).then((r) => r.filter(Boolean))) as [string, TracedFile][]
      );

      // Resolve traced packages
      type TracedPackage = {
        name: string;
        versions: Record<
          string,
          {
            pkgJSON: PackageJson;
            path: string;
            files: string[];
          }
        >;
      };
      const tracedPackages: Record<string, TracedPackage> = {};
      for (const tracedFile of Object.values(tracedFiles)) {
        // Use `node_modules/{name}` in path as name to support aliases
        const pkgName = tracedFile.pkgName;
        let tracedPackage = tracedPackages[pkgName];

        // Read package.json for file
        let pkgJSON = await readPackageJSON(tracedFile.pkgPath, {
          cache: true,
        }).catch(
          () => {} // TODO: Only catch ENOENT
        );
        if (!pkgJSON) {
          pkgJSON = <PackageJson>{ name: pkgName, version: "0.0.0" };
        }
        if (!tracedPackage) {
          tracedPackage = {
            name: pkgName,
            versions: {},
          };
          tracedPackages[pkgName] = tracedPackage;
        }
        let tracedPackageVersion =
          tracedPackage.versions[pkgJSON.version || "0.0.0"];
        if (!tracedPackageVersion) {
          tracedPackageVersion = {
            path: tracedFile.pkgPath,
            files: [],
            pkgJSON,
          };
          tracedPackage.versions[pkgJSON.version || "0.0.0"] =
            tracedPackageVersion;
        }
        tracedPackageVersion.files.push(tracedFile.path);
        tracedFile.pkgName = pkgName;
        if (pkgJSON.version) {
          tracedFile.pkgVersion = pkgJSON.version;
        }
      }

      const usedAliases: Record<string, string> = {};

      const writePackage = async (
        name: string,
        version: string,
        _pkgPath?: string
      ) => {
        // Find pkg
        const pkg = tracedPackages[name];
        const pkgPath = _pkgPath || pkg.name;

        // Copy files
        for (const src of pkg.versions[version].files) {
          const { subpath } = parseNodeModulePath(src);
          if (!subpath) {
            continue;
          }
          const dst = join(opts.outDir, "node_modules", pkgPath, subpath);
          await fsp.mkdir(dirname(dst), { recursive: true });
          await fsp.copyFile(src, dst);
          if (opts.chmod) {
            await fsp.chmod(dst, opts.chmod === true ? 0o644 : opts.chmod);
          }
        }

        // Copy package.json
        const pkgJSON = pkg.versions[version].pkgJSON;
        applyProductionCondition(pkgJSON.exports);
        const pkgJSONPath = join(
          opts.outDir,
          "node_modules",
          pkgPath,
          "package.json"
        );
        await fsp.mkdir(dirname(pkgJSONPath), { recursive: true });
        await fsp.writeFile(
          pkgJSONPath,
          JSON.stringify(pkgJSON, null, 2),
          "utf8"
        );

        // Link aliases
        if (opts.traceAlias && pkgPath in opts.traceAlias) {
          usedAliases[opts.traceAlias[pkgPath]] = version;
          await linkPackage(pkgPath, opts.traceAlias[pkgPath]);
        }
      };

      const isWindows = platform() === "win32";
      const linkPackage = async (from: string, to: string) => {
        const src = join(opts.outDir, "node_modules", from);
        const dst = join(opts.outDir, "node_modules", to);
        const dstStat = await fsp.lstat(dst).catch(() => null);
        const exists = dstStat?.isSymbolicLink();
        // console.log("Linking", from, "to", to, exists ? "!!!!" : "");
        if (exists) {
          return;
        }
        await fsp.mkdir(dirname(dst), { recursive: true });
        await fsp
          .symlink(
            relative(dirname(dst), src),
            dst,
            isWindows ? "junction" : "dir"
          )
          .catch((error) => {
            console.error("Cannot link", from, "to", to, error);
          });
      };

      // Utility to find package parents
      const findPackageParents = (pkg: TracedPackage, version: string) => {
        // Try to find parent packages
        const versionFiles: TracedFile[] = pkg.versions[version].files.map(
          (path) => tracedFiles[path]
        );
        const parentPkgs = [
          ...new Set(
            versionFiles.flatMap((file) =>
              file.parents
                .map((parentPath) => {
                  const parentFile = tracedFiles[parentPath];
                  if (parentFile.pkgName === pkg.name) {
                    return null;
                  }
                  return `${parentFile.pkgName}@${parentFile.pkgVersion}`;
                })
                .filter(Boolean)
            ) as string[]
          ),
        ];
        return parentPkgs;
      };

      // Analyze dependency tree
      const multiVersionPkgs: Record<string, { [version: string]: string[] }> =
        {};
      const singleVersionPackages: string[] = [];
      for (const tracedPackage of Object.values(tracedPackages)) {
        const versions = Object.keys(tracedPackage.versions);
        if (versions.length === 1) {
          singleVersionPackages.push(tracedPackage.name);
          continue;
        }
        multiVersionPkgs[tracedPackage.name] = {};
        for (const version of versions) {
          multiVersionPkgs[tracedPackage.name][version] = findPackageParents(
            tracedPackage,
            version
          );
        }
      }

      // Directly write single version packages
      await Promise.all(
        singleVersionPackages.map((pkgName) => {
          const pkg = tracedPackages[pkgName];
          const version = Object.keys(pkg.versions)[0];
          return writePackage(pkgName, version);
        })
      );

      // Write packages with multiple versions
      for (const [pkgName, pkgVersions] of Object.entries(multiVersionPkgs)) {
        const versionEntries = Object.entries(pkgVersions).sort(
          ([v1, p1], [v2, p2]) => {
            // 1. Package with no parent packages to be hoisted
            if (p1.length === 0) {
              return -1;
            }
            if (p2.length === 0) {
              return 1;
            }
            // 2. Newest version to be hoisted
            return compareVersions(v1, v2);
          }
        );
        for (const [version, parentPkgs] of versionEntries) {
          // Write each version into node_modules/.nitro/{name}@{version}
          await writePackage(pkgName, version, `.nitro/${pkgName}@${version}`);
          // Link one version to the top level (for indirect bundle deps)
          await linkPackage(`.nitro/${pkgName}@${version}`, `${pkgName}`);
          // Link to parent packages
          for (const parentPkg of parentPkgs) {
            const parentPkgName = parentPkg.replace(/@[^@]+$/, "");
            await (multiVersionPkgs[parentPkgName]
              ? linkPackage(
                  `.nitro/${pkgName}@${version}`,
                  `.nitro/${parentPkg}/node_modules/${pkgName}`
                )
              : linkPackage(
                  `.nitro/${pkgName}@${version}`,
                  `${parentPkgName}/node_modules/${pkgName}`
                ));
          }
        }
      }

      // Write an informative package.json
      const userPkg = await readPackageJSON(
        opts.rootDir || process.cwd()
      ).catch(() => ({}) as PackageJson);

      await writePackageJSON(resolve(opts.outDir, "package.json"), {
        name: (userPkg.name || "server") + "-prod",
        version: userPkg.version || "0.0.0",
        type: "module",
        private: true,
        dependencies: Object.fromEntries(
          [
            ...Object.values(tracedPackages).map((pkg) => [
              pkg.name,
              Object.keys(pkg.versions)[0],
            ]),
            ...Object.entries(usedAliases),
          ].sort(([a], [b]) => a.localeCompare(b))
        ),
      });
    },
  };
}

function compareVersions(v1 = "0.0.0", v2 = "0.0.0") {
  try {
    return semver.lt(v1, v2, { loose: true }) ? 1 : -1;
  } catch {
    return v1.localeCompare(v2);
  }
}

export function applyProductionCondition(exports: PackageJson["exports"]) {
  if (
    !exports ||
    typeof exports === "string" ||
    Array.isArray(exports) /* TODO: unhandled */
  ) {
    return;
  }
  if ("production" in exports) {
    if (typeof exports.production === "string") {
      exports.default = exports.production;
    } else {
      Object.assign(exports, exports.production);
    }
  }
  for (const key in exports) {
    applyProductionCondition(exports[key as keyof typeof exports]);
  }
}

async function isFile(file: string) {
  try {
    const stat = await fsp.stat(file);
    return stat.isFile();
  } catch (error) {
    if ((error as any)?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

type Matcher = ((
  id: string,
  importer?: string
) => Promise<boolean> | boolean) & { score?: number };

export function normalizeMatcher(input: string | RegExp | Matcher): Matcher {
  if (typeof input === "function") {
    input.score = input.score ?? 10_000;
    return input;
  }

  if (input instanceof RegExp) {
    const matcher = ((id: string) => input.test(id)) as Matcher;
    matcher.score = input.toString().length;
    Object.defineProperty(matcher, "name", { value: `match(${input})` });
    return matcher;
  }

  if (typeof input === "string") {
    const pattern = normalize(input);
    const matcher = ((id: string) => {
      const idWithoutNodeModules = id.split("node_modules/").pop();
      return (
        id.startsWith(pattern) || idWithoutNodeModules?.startsWith(pattern)
      );
    }) as Matcher;
    matcher.score = input.length;

    // Increase score for npm package names to avoid breaking changes
    // TODO: Remove in next major version
    if (!isAbsolute(input) && input[0] !== ".") {
      matcher.score += 1000;
    }

    Object.defineProperty(matcher, "name", { value: `match(${pattern})` });
    return matcher;
  }

  throw new Error(`Invalid matcher or pattern: ${input}`);
}
