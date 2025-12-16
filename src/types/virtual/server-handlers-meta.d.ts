import type { OperationObject } from "../openapi-ts";
import { NitroRouteMeta } from "nitropack/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: NitroRouteMeta;
}[];
