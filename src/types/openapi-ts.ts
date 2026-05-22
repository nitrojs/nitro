import type { OpenAPIV3_1 } from "@scalar/openapi-types";

export interface Extensable {
  [key: `x-${string}`]: any;
}

export type OpenAPI3 = OpenAPIV3_1.Document & Extensable;
export type OperationObject = OpenAPIV3_1.OperationObject;
export type ParameterObject = OpenAPIV3_1.ParameterObject;
export type PathItemObject = OpenAPIV3_1.PathItemObject;
export type PathsObject = OpenAPIV3_1.PathsObject;
