import { pathToFileURL } from "node:url";
import { defu } from "defu";
import mime from "mime";
import { writeFile } from "../utils/fs.ts";
import type { Nitro, NitroRouteRules, PrerenderRoute, PublicAssetDir } from "nitro/types";
import { join, relative, resolve } from "pathe";
import { createRouter, addRoute, findAllRoutes } from "rou3";
import { joinURL, withBase, withoutBase, withTrailingSlash } from "ufo";
import { build } from "../build/build.ts";
import { createNitro } from "../nitro.ts";
import { compressPublicAssets } from "../utils/compress.ts";
import { runParallel } from "../utils/parallel.ts";
import { extractLinks, formatPrerenderRoute, matchesIgnorePattern } from "./utils.ts";
import { scanUnprefixedPublicAssets } from "../build/assets.ts";
import { toRequest } from "h3";

const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/; // From unjs/destr

// const linkParents = new Map<string, Set<string>>();

export async function prerender(nitro: Nitro) {
  if (nitro.options.noPublicDir) {
    nitro.logger.warn("Skipping prerender since `noPublicDir` option is enabled.");
    return;
  }

  if (nitro.options.builder === "vite") {
    nitro.logger.warn("Skipping prerender since not supported with vite builder yet...");
    return;
  }

  // Initial list of routes to prerender
  const routes = new Set(nitro.options.prerender.routes);

  // Extend with static prerender route rules
  const prerenderRulePaths = Object.entries(nitro.options.routeRules)
    .filter(([path, options]) => options.prerender && !path.includes("*"))
    .map((e) => e[0]);
  for (const route of prerenderRulePaths) {
    routes.add(route);
  }

  // Allow extending prerender routes
  await nitro.hooks.callHook("prerender:routes", routes);

  // Skip if no prerender routes specified
  if (routes.size === 0) {
    // Crawl / at least if no routes are specified
    if (nitro.options.prerender.crawlLinks) {
      routes.add("/");
    } else {
      return;
    }
  }

  // Build with prerender preset
  nitro.logger.info("Initializing prerenderer");
  nitro._prerenderedRoutes = [];
  nitro._prerenderMeta = nitro._prerenderMeta || {};
  const prerendererConfig = {
    ...nitro.options._config,
    static: false,
    rootDir: nitro.options.rootDir,
    logLevel: 0,
    preset: "nitro-prerender",
  };
  await nitro.hooks.callHook("prerender:config", prerendererConfig);
  const nitroRenderer = await createNitro(prerendererConfig);
  const prerenderStartTime = Date.now();
  await nitro.hooks.callHook("prerender:init", nitroRenderer);

  // Set path to preview prerendered routes relative to the "host" nitro preset
  let path = relative(nitro.options.output.dir, nitro.options.output.publicDir);
  if (!path.startsWith(".")) {
    path = `./${path}`;
  }
  nitroRenderer.options.commands.preview = `npx serve ${path}`;
  nitroRenderer.options.output.dir = nitro.options.output.dir;

  await build(nitroRenderer);

  // Import renderer entry
  const serverFilename =
    typeof nitroRenderer.options.rollupConfig?.output?.entryFileNames === "string"
      ? nitroRenderer.options.rollupConfig.output.entryFileNames
      : "index.mjs";
  const serverEntrypoint = resolve(nitroRenderer.options.output.serverDir, serverFilename);
  const entryURL = pathToFileURL(serverEntrypoint).href;
  const prerenderer = (await import(entryURL).then((m: any) => m.default)) as {
    close: () => Promise<void>;
    fetch: (req: Request) => Promise<Response>;
  };

  // Create route rule matcher
  const routeRules = createRouter<NitroRouteRules>();
  for (const [route, rules] of Object.entries(nitro.options.routeRules)) {
    addRoute(routeRules, undefined, route, rules);
  }

  const _getRouteRules = (path: string) =>
    defu(
      {},
      ...findAllRoutes(routeRules, undefined, path)
        .map((r) => r.data)
        .reverse()
    ) as NitroRouteRules;

  // Start prerendering
  const generatedRoutes = new Set();
  const failedRoutes = new Set<PrerenderRoute>();
  const skippedRoutes = new Set();
  const displayedLengthWarns = new Set();

  const publicAssetBases: string[] = nitro.options.publicAssets
    .filter(
      (a): a is PublicAssetDir & { baseURL: string } =>
        !!a.baseURL && a.baseURL !== "/" && !a.fallthrough
    )
    .map((a) => withTrailingSlash(a.baseURL));

  const scannedPublicAssets = nitro.options.prerender.ignoreUnprefixedPublicAssets
    ? new Set(await scanUnprefixedPublicAssets(nitro))
    : new Set<string>();

  const canPrerender = (route = "/") => {
    // Skip if route is already generated or skipped
    if (generatedRoutes.has(route) || skippedRoutes.has(route)) {
      return false;
    }

    // Check for explicitly ignored routes
    if (nitro.options.prerender.ignore) {
      for (const pattern of nitro.options.prerender.ignore) {
        if (matchesIgnorePattern(route, pattern)) {
          return false;
        }
      }
    }

    if (publicAssetBases.some((base) => route.startsWith(base))) {
      return false;
    }

    if (scannedPublicAssets.has(route)) {
      return false;
    }

    // Check for route rules explicitly disabling prerender
    if (_getRouteRules(route).prerender === false) {
      return false;
    }

    return true;
  };

  const canWriteToDisk = (route: PrerenderRoute) => {
    // Cannot write routes with query
    if (route.route.includes("?")) {
      return false;
    }

    // Ensure length is not too long for filesystem
    // https://en.wikipedia.org/wiki/Comparison_of_file_systems#Limits
    const FS_MAX_SEGMENT = 255;
    // 1024 is the max path length on APFS (undocumented)
    const FS_MAX_PATH = 1024;
    const FS_MAX_PATH_PUBLIC_HTML = FS_MAX_PATH - (nitro.options.output.publicDir.length + 10);

    if (
      (route.route.length >= FS_MAX_PATH_PUBLIC_HTML ||
        route.route.split("/").some((s) => s.length > FS_MAX_SEGMENT)) &&
      !displayedLengthWarns.has(route)
    ) {
      displayedLengthWarns.add(route);
      const _route = route.route.slice(0, 60) + "...";
      if (route.route.length >= FS_MAX_PATH_PUBLIC_HTML) {
        nitro.logger.warn(
          `Prerendering long route "${_route}" (${route.route.length}) can cause filesystem issues since it exceeds ${FS_MAX_PATH_PUBLIC_HTML}-character limit when writing to \`${nitro.options.output.publicDir}\`.`
        );
      } else {
        nitro.logger.warn(
          `Skipping prerender of the route "${_route}" since it exceeds the ${FS_MAX_SEGMENT}-character limit in one of the path segments and can cause filesystem issues.`
        );
        return false;
      }
    }

    return true;
  };

  const generateRoute = async (route: string) => {
    const start = Date.now();

    // Ensure route is decoded to start with
    route = decodeURI(route);

    // Check if we should render route
    if (!canPrerender(route)) {
      skippedRoutes.add(route);
      return;
    }
    generatedRoutes.add(route);

    // Create result object
    const _route: PrerenderRoute = { route };

    // Fetch the route
    const encodedRoute = encodeURI(route);

    const req = toRequest(withBase(encodedRoute, nitro.options.baseURL), {
      headers: [["x-nitro-prerender", encodedRoute]],
      // TODO
      // retry: nitro.options.prerender.retry,
      // retryDelay: nitro.options.prerender.retryDelay,
    });
    const res = await prerenderer.fetch(req);
    // Data will be removed as soon as written to the disk
    let dataBuff: Buffer | undefined = Buffer.from(await res.arrayBuffer());

    Object.defineProperty(_route, "contents", {
      get: () => {
        return dataBuff ? dataBuff.toString("utf8") : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });
    Object.defineProperty(_route, "data", {
      get: () => {
        return dataBuff ? dataBuff.buffer : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
    const redirectCodes = [301, 302, 303, 304, 307, 308];
    if (![200, ...redirectCodes].includes(res.status)) {
      _route.error = new Error(`[${res.status}] ${res.statusText}`) as any;
      _route.error!.status = res.status;
      _route.error!.statusText = res.statusText;
    }

    // Measure actual time taken for generating route
    _route.generateTimeMS = Date.now() - start;

    // Guess route type and populate fileName
    const contentType = res.headers.get("content-type") || "";
    const isImplicitHTML =
      !route.endsWith(".html") &&
      contentType.includes("html") &&
      !JsonSigRx.test(dataBuff!.subarray(0, 32).toString("utf8"));
    const routeWithIndex = route.endsWith("/") ? route + "index" : route;
    const htmlPath =
      route.endsWith("/") || nitro.options.prerender.autoSubfolderIndex
        ? joinURL(route, "index.html")
        : route + ".html";
    _route.fileName = withoutBase(
      isImplicitHTML ? htmlPath : routeWithIndex,
      nitro.options.baseURL
    );
    // Allow overriding content-type in `prerender:generate` hook
    const inferredContentType = mime.getType(_route.fileName) || "text/plain";
    _route.contentType = contentType || inferredContentType;

    // Allow hooking before generate
    await nitro.hooks.callHook("prerender:generate", _route, nitro);
    if (_route.contentType !== inferredContentType) {
      nitro._prerenderMeta![_route.fileName] ||= {};
      nitro._prerenderMeta![_route.fileName].contentType = _route.contentType;
    }

    // After hook to allow ignoring in `prerender:generate` hook
    if (_route.error) {
      failedRoutes.add(_route);
    }

    // Check if route is skipped or has errors
    if (_route.skip || _route.error) {
      await nitro.hooks.callHook("prerender:route", _route);
      nitro.logger.log(formatPrerenderRoute(_route));
      dataBuff = undefined; // Free memory
      return _route;
    }

    // Write to the disk
    if (canWriteToDisk(_route)) {
      const filePath = join(nitro.options.output.publicDir, _route.fileName);
      await writeFile(filePath, dataBuff!);
      nitro._prerenderedRoutes!.push(_route);
    } else {
      _route.skip = true;
    }

    // Crawl route links
    if (!_route.error && (isImplicitHTML || route.endsWith(".html"))) {
      const extractedLinks = await extractLinks(
        dataBuff!.toString("utf8"),
        route,
        res,
        nitro.options.prerender.crawlLinks ?? false
      );
      for (const _link of extractedLinks) {
        if (canPrerender(_link)) {
          routes.add(_link);
        }
      }
    }

    await nitro.hooks.callHook("prerender:route", _route);
    nitro.logger.log(formatPrerenderRoute(_route));

    dataBuff = undefined; // Free memory
    return _route;
  };

  nitro.logger.info(
    nitro.options.prerender.crawlLinks
      ? `Prerendering ${routes.size} initial routes with crawler`
      : `Prerendering ${routes.size} routes`
  );

  await runParallel(routes, generateRoute, {
    concurrency: nitro.options.prerender.concurrency || 1,
    interval: nitro.options.prerender.interval,
  });

  await prerenderer.close();

  await nitro.hooks.callHook("prerender:done", {
    prerenderedRoutes: nitro._prerenderedRoutes,
    failedRoutes: [...failedRoutes],
  });

  if (nitro.options.prerender.failOnError && failedRoutes.size > 0) {
    nitro.logger.log("\nErrors prerendering:");
    for (const route of failedRoutes) {
      // const parents = linkParents.get(route.route);
      // const parentsText = parents?.size
      //   ? `\n${[...parents.values()]
      //       .map((link) => colors.gray(`  │ └── Linked from ${link}`))
      //       .join("\n")}`
      //   : "";
      nitro.logger.log(formatPrerenderRoute(route));
    }
    nitro.logger.log("");
    throw new Error("Exiting due to prerender errors.");
  }

  const prerenderTimeInMs = Date.now() - prerenderStartTime;
  nitro.logger.info(
    `Prerendered ${nitro._prerenderedRoutes.length} routes in ${prerenderTimeInMs / 1000} seconds`
  );

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }
}
