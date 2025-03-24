import type { OperationObject } from "../openapi-ts";
import { NitroRouteMeta } from "nitro/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: NitroRouteMeta;
}[];
