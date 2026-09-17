import { fetch } from "./helper.ts";

export const render = (url: string) => `${url}:${typeof fetch}`;
