import "./_runtime_warn.ts";

export type NitroService = { fetch: (req: Request) => Response | Promise<Response> };

export declare const services: Record<string, NitroService>;
