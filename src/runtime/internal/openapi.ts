type JSONSchema = Record<string, any>;

interface StandardJSONSchema {
  "~standard"?: {
    jsonSchema?: {
      input?: (options: { target: string }) => JSONSchema;
    };
  };
}

const schemaCache = new WeakMap<object, JSONSchema | null>();

export function standardSchemaToJSONSchema(
  schema: StandardJSONSchema | undefined,
  options: { context: string }
): JSONSchema | undefined {
  if (!schema || (typeof schema !== "object" && typeof schema !== "function")) {
    return;
  }
  if (schemaCache.has(schema)) {
    return schemaCache.get(schema) || undefined;
  }

  const convert = schema["~standard"]?.jsonSchema?.input;
  if (!convert) {
    console.warn(
      `[nitro] Cannot generate the OpenAPI schema for ${options.context}. The validation schema does not implement Standard JSON Schema.`
    );
    schemaCache.set(schema, null);
    return;
  }

  try {
    const converted = normalizeJSONSchema(convert({ target: "draft-2020-12" }));
    schemaCache.set(schema, converted);
    return converted;
  } catch (error) {
    console.warn(`[nitro] Cannot generate the OpenAPI schema for ${options.context}.`, error);
    schemaCache.set(schema, null);
  }
}

function normalizeJSONSchema(schema: JSONSchema): JSONSchema {
  return dereference(schema, { root: schema, seen: new Set() }) as JSONSchema;
}

function dereference(value: any, options: { root: JSONSchema; seen: Set<string> }): any {
  if (Array.isArray(value)) {
    return value.map((item) => dereference(item, options));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    if (options.seen.has(value.$ref)) {
      return value;
    }
    const target = resolveJSONPointer(options.root, { pointer: value.$ref });
    if (target) {
      const nextSeen = new Set(options.seen).add(value.$ref);
      const { $ref: _, ...rest } = value;
      return {
        ...dereference(target, { ...options, seen: nextSeen }),
        ...dereference(rest, { ...options, seen: nextSeen }),
      };
    }
  }

  const normalized: JSONSchema = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== "$schema") {
      normalized[key] = dereference(item, options);
    }
  }
  return normalized;
}

function resolveJSONPointer(root: JSONSchema, options: { pointer: string }): any {
  let value: any = root;
  for (const segment of options.pointer
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    value = value?.[segment];
  }
  return value;
}
