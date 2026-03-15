import { defineHandler, getRequestURL } from "h3";
import type { EventHandler, HTTPMethod } from "h3";
import type {
  Extensable,
  OpenAPI3,
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
} from "../../../types/openapi-ts.ts";
import { joinURL } from "ufo";
import { defu } from "defu";
import { handlersMeta } from "#nitro/virtual/routing-meta";
import { useRuntimeConfig } from "../runtime-config.ts";

// Served as /_openapi.json
export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();

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

  return {
    openapi: "3.1.0",
    info: {
      title: meta?.title,
      version: meta?.version || "1.0.0",
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
  } satisfies OpenAPI3;
}) as EventHandler;

type OpenAPIGlobals = Pick<OpenAPI3, "components"> & Extensable;

function getHandlersMeta(): {
  paths: PathsObject;
  globals: OpenAPIGlobals;
} {
  const paths: PathsObject = {};
  let globals: OpenAPIGlobals = {};

  for (const h of handlersMeta) {
    const { $global, ...openAPI } = h.meta?.openAPI || {};
    const { route, parameters: _parameters } = normalizeRoute(h.route || "", openAPI);
    const parameters = defu(openAPI.parameters || [], _parameters);
    const tags = defaultTags(h.route || "");
    const method = (h.method || "get").toLowerCase() as Lowercase<HTTPMethod>;

    const item: PathItemObject = {
      [method]: {
        tags,
        parameters,
        responses: {
          200: { description: "OK" },
        },
        ...openAPI,
      } satisfies OperationObject,
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

function normalizeRoute(_route: string, openAPI: OperationObject) {
  const parameters: ParameterObject[] = [];
  const userDefinedParameters = (Array.isArray(openAPI.parameters) ? openAPI.parameters : []) as ParameterObject[];

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
      if (userDefinedParameters.some((p) => p.name === name)) {
        /**
         * If user has already defined the path variable, let that take precedence.
         */
        continue;
      }
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
