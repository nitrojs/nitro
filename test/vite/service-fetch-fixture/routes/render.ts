import { fetchViteEnv } from "nitro/vite/runtime";

export default (event: any) => fetchViteEnv("render", event.req);
