import { type HTTPMethod, eventHandler, getRequestURL } from "h3";
import type {
  ComponentsObject,
  OpenAPI3,
  OperationObject,
  ParameterObject,
  PathItemObject,
  PathsObject,
} from "openapi-typescript";
import { joinURL } from "ufo";
import { handlersMeta } from "#nitro-internal-virtual/server-handlers-meta";
import { useRuntimeConfig } from "../config";
import type { DeepPartial } from "../../../types/_utils";

// Served as /_openapi.json
export default eventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);

  const base = runtimeConfig.app?.baseURL;
  const url = joinURL(getRequestURL(event).origin, base);

  const meta = {
    title: "Nitro Server Routes",
    ...runtimeConfig.nitro?.openAPI?.meta,
  };

  const { paths, components } = getOpenApiMeta();

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
  };
});

function getOpenApiMeta(): DeepPartial<OpenAPI3> {
  const paths: PathsObject = {};
  const componentsSchema: ComponentsObject = {
    schemas: {},
  };

  for (const h of handlersMeta) {
    const { route, parameters } = normalizeRoute(h.route || "");
    const tags = defaultTags(h.route || "");
    const method = (h.method || "get").toLowerCase() as Lowercase<HTTPMethod>;
    const { components, ...openAPI } = h.meta?.openAPI || {};

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

    if (components) {
      Object.assign(componentsSchema.schemas!, components);
    }

    if (paths[route] === undefined) {
      paths[route] = item;
    } else {
      Object.assign(paths[route], item);
    }
  }

  return { paths, components: componentsSchema };
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
