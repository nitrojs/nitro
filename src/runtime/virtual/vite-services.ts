import "./_runtime_warn.ts";

export type ViteService = { fetch: (req: Request) => Response | Promise<Response> };

export declare const viteServices: Record<string, ViteService>;
