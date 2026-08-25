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
import { standardSchemaToJSONSchema } from "../openapi.ts";

// Served as /_openapi.json
export default defineHandler(async (event) => {
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
  } = await getHandlersMeta();

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

async function getHandlersMeta(): Promise<{
  paths: PathsObject;
  globals: OpenAPIGlobals;
}> {
  const paths: PathsObject = {};
  let globals: OpenAPIGlobals = {};
  const requestSchemas = await Promise.all(
    handlersMeta.map(async (handler) => {
      try {
        return await handler.schema?.request?.();
      } catch (error) {
        console.warn(`[nitro] Cannot load request schemas for ${handler.route}.`, error);
      }
    })
  );

  for (const [index, h] of handlersMeta.entries()) {
    const { route, parameters } = normalizeRoute(h.route || "");
    const tags = defaultTags(h.route || "");
    const method = (h.method || "get").toLowerCase() as Lowercase<HTTPMethod>;
    const { $global, ...openAPI } = h.meta?.openAPI || {};
    const requestSchema = requestSchemas[index];
    const requestBodySchema = standardSchemaToJSONSchema(requestSchema?.body, {
      context: `${method.toUpperCase()} ${route} request body`,
    });
    const querySchema = standardSchemaToJSONSchema(requestSchema?.query, {
      context: `${method.toUpperCase()} ${route} query`,
    });
    const headersSchema = standardSchemaToJSONSchema(requestSchema?.headers, {
      context: `${method.toUpperCase()} ${route} headers`,
    });
    const requestParameters = [
      ...parameters,
      ...schemaToParameters(querySchema, { location: "query" }),
      ...schemaToParameters(headersSchema, { location: "header" }),
    ];
    const responseSchema = h.schema?.response;

    const item: PathItemObject = {
      [method]: {
        tags,
        parameters: requestParameters,
        ...(requestBodySchema && {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: requestBodySchema },
            },
          },
        }),
        responses: {
          200: {
            description: "OK",
            ...(responseSchema && {
              content: {
                [responseContentType(responseSchema)]: { schema: responseSchema },
              },
            }),
          },
        },
        ...openAPI,
      } as OperationObject,
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

function schemaToParameters(
  schema: Record<string, any> | undefined,
  options: { location: "query" | "header" }
): ParameterObject[] {
  if (!schema?.properties || typeof schema.properties !== "object") {
    return [];
  }
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.entries(schema.properties).map(([name, propertySchema]) => ({
    name,
    in: options.location,
    required: required.has(name),
    schema: inheritLocalDefinitions(propertySchema, { root: schema }),
  }));
}

function responseContentType(schema: Record<string, any>): string {
  return schema.type === "string" ? "text/plain" : "application/json";
}

function inheritLocalDefinitions(
  schema: any,
  options: { root: Record<string, any> }
): ParameterObject["schema"] {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }
  const rootDefinitions = options.root.$defs;
  const legacyRootDefinitions = options.root.definitions;
  if ((!rootDefinitions && !legacyRootDefinitions) || !hasLocalReference(schema)) {
    return schema;
  }
  return {
    ...schema,
    ...(rootDefinitions && {
      $defs: { ...rootDefinitions, ...schema.$defs },
    }),
    ...(legacyRootDefinitions && {
      definitions: { ...legacyRootDefinitions, ...schema.definitions },
    }),
  };
}

function hasLocalReference(value: any): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasLocalReference(item));
  }
  return (
    (typeof value.$ref === "string" && value.$ref.startsWith("#/")) ||
    Object.values(value).some((item) => hasLocalReference(item))
  );
}
