import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Nitro } from "nitro/types";
import { joinURL } from "ufo";
import type { AmplifyDeployManifest, AmplifyRoute, AmplifyRouteTarget } from "./types.ts";

export async function writeAmplifyFiles(nitro: Nitro) {
  const outDir = nitro.options.output.dir;

  // Generate routes
  const routes: AmplifyRoute[] = [];

  let hasWildcardPublicAsset = false;

  if (nitro.options.awsAmplify?.imageOptimization && !nitro.options.static) {
    const { path, cacheControl } = nitro.options.awsAmplify?.imageOptimization || {};
    if (path) {
      routes.push({
        path,
        target: {
          kind: "ImageOptimization",
          cacheControl,
        },
      });
    }
  }

  const computeTarget: AmplifyRouteTarget = nitro.options.static
    ? { kind: "Static" }
    : { kind: "Compute", src: "default" };

  for (const publicAsset of nitro.options.publicAssets) {
    if (!publicAsset.baseURL || publicAsset.baseURL === "/") {
      hasWildcardPublicAsset = true;
      continue;
    }
    routes.push({
      path: `${publicAsset.baseURL!.replace(/\/$/, "")}/*`,
      target: {
        kind: "Static",
        cacheControl:
          publicAsset.maxAge > 0 ? `public, max-age=${publicAsset.maxAge}, immutable` : undefined,
      },
      fallback: publicAsset.fallthrough ? computeTarget : undefined,
    });
  }
  if (hasWildcardPublicAsset && !nitro.options.static) {
    routes.push({
      path: "/*.*",
      target: {
        kind: "Static",
      },
      fallback: computeTarget,
    });
  }
  routes.push({
    path: "/*",
    target: computeTarget,
    fallback:
      hasWildcardPublicAsset && nitro.options.awsAmplify?.catchAllStaticFallback
        ? {
            kind: "Static",
          }
        : undefined,
  });

  // Prefix with baseURL
  for (const route of routes) {
    if (route.path !== "/*") {
      route.path = joinURL(nitro.options.baseURL, route.path);
    }
  }

  // Generate deploy-manifest.json
  const deployManifest: AmplifyDeployManifest = {
    version: 1,
    routes,
    imageSettings: nitro.options.awsAmplify?.imageSettings || undefined,
    computeResources: nitro.options.static
      ? undefined
      : [
          {
            name: "default",
            entrypoint: "server.js",
            runtime: nitro.options.awsAmplify?.runtime || "nodejs20.x",
          },
        ],
    framework: {
      name: nitro.options.framework.name || "nitro",
      version: nitro.options.framework.version || "0.0.0",
    },
  };
  await writeFile(resolve(outDir, "deploy-manifest.json"), JSON.stringify(deployManifest, null, 2));

  // Write server.js (CJS)
  if (!nitro.options.static) {
    await writeFile(resolve(outDir, "compute/default/server.js"), `import("./index.mjs")`);
  }
}
