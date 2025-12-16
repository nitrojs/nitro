import "./_runtime_warn.ts";
import type { NitroRouteMeta } from "nitro/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: NitroRouteMeta;
}[] = [];
