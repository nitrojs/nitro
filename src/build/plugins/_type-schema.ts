export type JSONSchema = Record<string, unknown>;

interface TypeSchemaContext {
  checker: any;
  sourceFile: any;
  signatureKind: number;
  symbolFlags: Record<string, number>;
  typeFlags: Record<string, number>;
}

const SKIPPED_OBJECTS = new Set([
  "Blob",
  "File",
  "FormData",
  "HTTPResponse",
  "ReadableStream",
  "Request",
  "Response",
  "Uint8Array",
]);

export function typeToJSONSchema(type: any, ctx: TypeSchemaContext): JSONSchema | undefined {
  return _typeToJSONSchema(type, ctx, { depth: 0, root: true, seen: new Set() });
}

function _typeToJSONSchema(
  type: any,
  ctx: TypeSchemaContext,
  state: { depth: number; root: boolean; seen: Set<any> }
): JSONSchema | undefined {
  if (!type || state.depth > 10 || type.isErrorType?.()) {
    return;
  }

  const { checker, typeFlags } = ctx;
  const flags = type.flags || 0;
  const name = typeName(type);
  const typeArguments = getTypeArguments(type, checker);

  if ((name === "Promise" || name === "PromiseLike") && typeArguments[0]) {
    return _typeToJSONSchema(typeArguments[0], ctx, state);
  }
  if (SKIPPED_OBJECTS.has(name)) {
    return;
  }
  if (name === "Date") {
    return { type: "string", format: "date-time" };
  }
  if (flags & (typeFlags.Any | typeFlags.Unknown)) {
    return state.root ? undefined : {};
  }
  if (flags & (typeFlags.Undefined | typeFlags.Void | typeFlags.Never)) {
    return;
  }
  if (flags & typeFlags.Null) {
    return { type: "null" };
  }
  if (flags & typeFlags.StringLiteral) {
    return { type: "string", const: type.value };
  }
  if (flags & typeFlags.NumberLiteral) {
    return { type: "number", const: type.value };
  }
  if (flags & typeFlags.BooleanLiteral) {
    const value = type.value ?? type.intrinsicName === "true";
    return { type: "boolean", const: value };
  }
  if (flags & (typeFlags.String | typeFlags.TemplateLiteral | typeFlags.StringMapping)) {
    return { type: "string" };
  }
  if (flags & typeFlags.Number) {
    return { type: "number" };
  }
  if (flags & (typeFlags.BigInt | typeFlags.BigIntLiteral)) {
    return { type: "integer", format: "int64" };
  }
  if (flags & typeFlags.Boolean) {
    return { type: "boolean" };
  }
  if (flags & typeFlags.Union) {
    const schemas = getTypes(type)
      .map((member) =>
        _typeToJSONSchema(member, ctx, { ...state, root: false, depth: state.depth + 1 })
      )
      .filter(Boolean) as JSONSchema[];
    return unionSchema(schemas);
  }
  if (flags & typeFlags.Intersection) {
    const allOf = getTypes(type)
      .map((member) =>
        _typeToJSONSchema(member, ctx, { ...state, root: false, depth: state.depth + 1 })
      )
      .filter(Boolean) as JSONSchema[];
    return allOf.length > 0 ? { allOf } : undefined;
  }
  if (flags & typeFlags.TypeParameter) {
    const constraint =
      checker.getBaseConstraintOfType(type) || checker.getConstraintOfTypeParameter(type);
    return constraint ? _typeToJSONSchema(constraint, ctx, state) : state.root ? undefined : {};
  }
  if (!(flags & typeFlags.Object)) {
    return;
  }
  if (checker.getSignaturesOfType(type, ctx.signatureKind).length > 0) {
    return;
  }
  if (checker.isArrayType(type)) {
    const items = typeArguments[0]
      ? _typeToJSONSchema(typeArguments[0], ctx, { ...state, root: false, depth: state.depth + 1 })
      : {};
    return { type: "array", items: items || {} };
  }
  if (checker.isTupleType(type)) {
    const prefixItems = typeArguments.map(
      (item) =>
        _typeToJSONSchema(item, ctx, { ...state, root: false, depth: state.depth + 1 }) || {}
    );
    return {
      type: "array",
      prefixItems,
      minItems: prefixItems.length,
      maxItems: prefixItems.length,
    };
  }
  if (state.seen.has(type)) {
    return {};
  }

  const seen = new Set(state.seen).add(type);
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];
  for (const property of checker.getPropertiesOfType(type).slice(0, 100)) {
    const propertyName = property.name || String(property.escapedName);
    if (propertyName.startsWith("__@")) {
      continue;
    }
    const propertyType = checker.getTypeOfSymbolAtLocation(property, ctx.sourceFile);
    const propertySchema = _typeToJSONSchema(propertyType, ctx, {
      depth: state.depth + 1,
      root: false,
      seen,
    });
    if (!propertySchema) {
      continue;
    }
    properties[propertyName] = propertySchema;
    if (!(property.flags & ctx.symbolFlags.Optional)) {
      required.push(propertyName);
    }
  }

  const schema: JSONSchema = { type: "object", properties };
  const indexInfo = checker.getIndexInfosOfType(type)[0];
  if (indexInfo?.type) {
    schema.additionalProperties =
      _typeToJSONSchema(indexInfo.type, ctx, {
        depth: state.depth + 1,
        root: false,
        seen,
      }) || {};
  }
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

function getTypes(type: any): any[] {
  return [...(type.getTypes?.() || type.types || [])];
}

function getTypeArguments(type: any, checker: any): any[] {
  try {
    return [...(checker.getTypeArguments(type) || type.getAliasTypeArguments?.() || [])];
  } catch {
    return [...(type.getAliasTypeArguments?.() || [])];
  }
}

function typeName(type: any): string {
  return (
    type.getAliasSymbol?.()?.name ||
    type.aliasSymbol?.name ||
    type.getSymbol?.()?.name ||
    type.symbol?.name ||
    ""
  );
}

function unionSchema(schemas: JSONSchema[]): JSONSchema | undefined {
  if (schemas.length === 0) {
    return;
  }
  if (schemas.length === 1) {
    return schemas[0];
  }
  if (schemas.every((schema) => "const" in schema)) {
    const values = schemas.map((schema) => schema.const);
    const types = new Set(schemas.map((schema) => schema.type));
    if (types.size === 1) {
      if (schemas[0].type === "boolean" && values.includes(true) && values.includes(false)) {
        return { type: "boolean" };
      }
      return { type: schemas[0].type, enum: values };
    }
  }
  return { anyOf: schemas };
}
