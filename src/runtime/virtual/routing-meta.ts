import "./_runtime_warn.ts";
import type { NitroRouteMeta } from "nitro/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: NitroRouteMeta;
  schema?: {
    request?: () => Promise<{
      body?: any;
      query?: any;
      headers?: any;
    }>;
    response?: Record<string, any>;
  };
}[] = [];
