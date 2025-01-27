import { type HTTPMethod, eventHandler, getRequestURL } from "h3";
import type {
  OpenAPI3,
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
} from "openapi-typescript";
import { joinURL } from "ufo";
import { handlersMeta } from "#nitro-internal-virtual/server-handlers-meta";
import { useRuntimeConfig } from "../config";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import type { NitroRouteRules, NitroRuntimeConfig } from "nitropack/types";
import defu from "defu";

// Served as /_openapi.json
export default eventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);

  const base = runtimeConfig.app?.baseURL;
  const url = joinURL(getRequestURL(event).origin, base);

  const meta = {
    title: "Nitro Server Routes",
    ...runtimeConfig.nitro?.openAPI?.meta,
  };

  return <OpenAPI3>{
    openapi: "3.1.0",
    info: {
      title: meta?.title,
      version: meta?.version,
      description: meta?.description,
    },
    servers: [
      {
        url,
        description: "Local Development Server",
        variables: {},
      },
    ],
    paths: getPaths(runtimeConfig),
  };
});

function getPaths(runtimeConfig: NitroRuntimeConfig): PathsObject {
  const paths: PathsObject = {};

  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: runtimeConfig.nitro.routeRules })
  );

  const _getRouteRules = (path: string) =>
    defu({}, ..._routeRulesMatcher.matchAll(path).reverse()) as NitroRouteRules;

  for (const h of handlersMeta) {
    const enabledInRouteMeta = h.meta && h.meta.openAPIEnabled;
    const enabledInRouteRules =
      h.route && _getRouteRules(h.route).openAPIEnabled;
    const openAPIEnabled = enabledInRouteMeta ?? enabledInRouteRules;
    if (openAPIEnabled === false) continue;

    const { route, parameters } = normalizeRoute(h.route || "");
    const tags = defaultTags(h.route || "");
    const method = (h.method || "get").toLowerCase() as Lowercase<HTTPMethod>;

    const item: PathItemObject = {
      [method]: <OperationObject>{
        tags,
        parameters,
        responses: {
          200: { description: "OK" },
        },
        ...h.meta?.openAPI,
      },
    };

    if (paths[route] === undefined) {
      paths[route] = item;
    } else {
      Object.assign(paths[route], item);
    }
  }

  return paths;
}

function normalizeRoute(_route: string) {
  const parameters: ParameterObject[] = [];

  let anonymousCtr = 0;
  const route = _route
    .replace(/:(\w+)/g, (_, name) => `{${name}}`)
    .replace(/\/(\*)\//g, () => `/{param${++anonymousCtr}}/`)
    .replace(/\*\*{/, "{")
    .replace(/\/(\*\*)$/g, () => `/{*param${++anonymousCtr}}`);

  const paramMatches = route.matchAll(/{(\*?\w+)}/g);
  for (const match of paramMatches) {
    const name = match[1];
    if (!parameters.some((p) => p.name === name)) {
      parameters.push({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }
  }

  return {
    route,
    parameters,
  };
}

function defaultTags(route: string) {
  const tags: string[] = [];

  if (route.startsWith("/api/")) {
    tags.push("API Routes");
  } else if (route.startsWith("/_")) {
    tags.push("Internal");
  } else {
    tags.push("App Routes");
  }

  return tags;
}
