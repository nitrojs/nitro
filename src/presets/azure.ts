import { readFile } from "node:fs/promises";
import { join, resolve } from "pathe";
import { writeFile } from "../utils";
import { defineNitroPreset } from "../preset";
import type { Nitro } from "../types";

export const azure = defineNitroPreset({
  entry: "#internal/nitro/entries/azure",
  output: {
    serverDir: "{{ output.dir }}/server/functions",
    publicDir: "{{ output.dir }}/public/{{ baseURL }}",
  },
  commands: {
    preview:
      "npx @azure/static-web-apps-cli start ./public --api-location ./server",
  },
  hooks: {
    async compiled(ctx: Nitro) {
      await writeRoutes(ctx);
    },
  },
});

async function writeRoutes(nitro: Nitro) {
  const host = {
    version: "2.0",
  };

  let nodeVersion = "16";
  try {
    const currentNodeVersion = JSON.parse(
      await readFile(join(nitro.options.rootDir, "package.json"), "utf8")
    ).engines.node;
    if (["16", "14"].includes(currentNodeVersion)) {
      nodeVersion = currentNodeVersion;
    }
  } catch {
    const currentNodeVersion = process.versions.node.slice(0, 2);
    if (["16", "14"].includes(currentNodeVersion)) {
      nodeVersion = currentNodeVersion;
    }
  }

  // Merge custom config into the generated config
  const config = {
    ...nitro.options.azure?.config,
    routes: [], // Overwrite routes for now, we will add existing routes after generating routes
    platform: {
      apiRuntime: `node:${nodeVersion}`,
      ...nitro.options.azure?.config?.platform,
    },
    navigationFallback: {
      rewrite: "/api/server",
      ...nitro.options.azure?.config?.navigationFallback,
    },
  };

  const routeFiles = nitro._prerenderedRoutes || [];

  const indexFileExists = routeFiles.some(
    (route) => route.fileName === "/index.html"
  );
  if (!indexFileExists) {
    config.routes.unshift(
      {
        route: "/index.html",
        redirect: "/",
      },
      {
        route: "/",
        rewrite: "/api/server",
      }
    );
  }

  const suffix = "/index.html".length;
  for (const { fileName } of routeFiles) {
    if (!fileName.endsWith("/index.html")) {
      continue;
    }

    config.routes.unshift({
      route: fileName.slice(0, -suffix) || "/",
      rewrite: fileName,
    });
  }

  for (const { fileName } of routeFiles) {
    if (!fileName.endsWith(".html") || fileName.endsWith("index.html")) {
      continue;
    }

    const route = fileName.slice(0, -".html".length);
    const existingRouteIndex = config.routes.findIndex(
      (_route) => _route.route === route
    );
    if (existingRouteIndex > -1) {
      config.routes.splice(existingRouteIndex, 1);
    }
    config.routes.unshift({
      route,
      rewrite: fileName,
    });
  }

  // Prepend custom routes to the beginning of the routes array and override if they exist
  if (
    nitro.options.azure?.config &&
    "routes" in nitro.options.azure.config &&
    Array.isArray(nitro.options.azure.config.routes)
  ) {
    // We iterate through the reverse so the order in the custom config is persisted
    for (const customRoute of nitro.options.azure.config.routes.reverse()) {
      const existingRouteMatchIndex = config.routes.findIndex(
        (value) => value.route === customRoute.route
      );

      if (existingRouteMatchIndex === -1) {
        // If we don't find a match, put the customRoute at the beginning of the array
        config.routes.unshift(customRoute);
      } else {
        // Otherwise override the existing route with our customRoute
        config.routes[existingRouteMatchIndex] = customRoute;
      }
    }
  }

  const functionDefinition = {
    entryPoint: "handle",
    bindings: [
      {
        authLevel: "anonymous",
        type: "httpTrigger",
        direction: "in",
        name: "req",
        route: "{*url}",
        methods: ["delete", "get", "head", "options", "patch", "post", "put"],
      },
      {
        type: "http",
        direction: "out",
        name: "res",
      },
    ],
  };

  await writeFile(
    resolve(nitro.options.output.serverDir, "function.json"),
    JSON.stringify(functionDefinition, null, 2)
  );
  await writeFile(
    resolve(nitro.options.output.serverDir, "../host.json"),
    JSON.stringify(host, null, 2)
  );
  const stubPackageJson = resolve(
    nitro.options.output.serverDir,
    "../package.json"
  );
  await writeFile(stubPackageJson, JSON.stringify({ private: true }));
  await writeFile(
    resolve(nitro.options.rootDir, "staticwebapp.config.json"),
    JSON.stringify(config, null, 2)
  );
  if (!indexFileExists) {
    const baseURLSegments = nitro.options.baseURL.split("/").filter(Boolean);
    const relativePrefix = baseURLSegments.map(() => "..").join("/");
    await writeFile(
      resolve(
        nitro.options.output.publicDir,
        relativePrefix ? `${relativePrefix}/index.html` : "index.html"
      ),
      ""
    );
  }
}
