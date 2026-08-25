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
  context: string
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
      `[nitro] Cannot generate the OpenAPI schema for ${context}. The validation schema does not implement Standard JSON Schema.`
    );
    schemaCache.set(schema, null);
    return;
  }

  try {
    const converted = normalizeJSONSchema(convert({ target: "draft-2020-12" }));
    schemaCache.set(schema, converted);
    return converted;
  } catch (error) {
    console.warn(`[nitro] Cannot generate the OpenAPI schema for ${context}.`, error);
    schemaCache.set(schema, null);
  }
}

function normalizeJSONSchema(schema: JSONSchema): JSONSchema {
  return dereference(schema, schema, new Set()) as JSONSchema;
}

function dereference(value: any, root: JSONSchema, seen: Set<string>): any {
  if (Array.isArray(value)) {
    return value.map((item) => dereference(item, root, seen));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    if (seen.has(value.$ref)) {
      return {};
    }
    const target = resolveJSONPointer(root, value.$ref);
    if (target) {
      const nextSeen = new Set(seen).add(value.$ref);
      const { $ref: _, ...rest } = value;
      return {
        ...dereference(target, root, nextSeen),
        ...dereference(rest, root, nextSeen),
      };
    }
  }

  const normalized: JSONSchema = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== "$schema" && key !== "$defs" && key !== "definitions") {
      normalized[key] = dereference(item, root, seen);
    }
  }
  return normalized;
}

function resolveJSONPointer(root: JSONSchema, pointer: string): any {
  let value: any = root;
  for (const segment of pointer
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    value = value?.[segment];
  }
  return value;
}
