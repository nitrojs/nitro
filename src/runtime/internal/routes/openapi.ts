import { type HTTPMethod, eventHandler, getRequestURL } from "h3";
import type {
  Extensable,
  OpenAPI3,
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
} from "#internal/types/openapi-ts";
import { joinURL } from "ufo";
import { defu } from "defu";
import { handlersMeta } from "#nitro-internal-virtual/server-handlers-meta";
import { useRuntimeConfig } from "../config";
import { getRouteRulesForPath } from "../route-rules";

// Served as /_openapi.json
export default eventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);

  const base = runtimeConfig.app?.baseURL;
  const url = joinURL(getRequestURL(event).origin, base);

  const meta = {
    title: "Nitro Server Routes",
    ...runtimeConfig.nitro?.openAPI?.meta,
  };

  const {
    paths,
    globals: { components, ...globalsRest },
  } = getHandlersMeta();

  const extensible: Extensable = Object.fromEntries(
    Object.entries(globalsRest).filter(([key]) => key.startsWith("x-"))
  );

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
    paths,
    components,
    ...extensible,
  };
});

type OpenAPIGlobals = Pick<OpenAPI3, "components"> & Extensable;

function getHandlersMeta(): {
  paths: PathsObject;
  globals: OpenAPIGlobals;
} {
  const paths: PathsObject = {};
  let globals: OpenAPIGlobals = {};

  for (const h of handlersMeta) {
    const enabledInRouteMeta = h.meta && h.meta.openAPIEnabled;
    const enabledInRouteRules =
      h.route && getRouteRulesForPath(h.route).openAPIEnabled;
    const openAPIEnabled = enabledInRouteMeta ?? enabledInRouteRules;
    if (openAPIEnabled === false) continue;

    const { route, parameters } = normalizeRoute(h.route || "");
    const tags = defaultTags(h.route || "");
    const method = (h.method || "get").toLowerCase() as Lowercase<HTTPMethod>;
    const { $global, ...openAPI } = h.meta?.openAPI || {};

    const item: PathItemObject = {
      [method]: <OperationObject>{
        tags,
        parameters,
        responses: {
          200: { description: "OK" },
        },
        ...openAPI,
      },
    };

    if ($global) {
      // TODO: Warn on conflicting global definitions?
      globals = defu($global, globals);
    }

    if (paths[route] === undefined) {
      paths[route] = item;
    } else {
      Object.assign(paths[route], item);
    }
  }

  return { paths, globals };
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
