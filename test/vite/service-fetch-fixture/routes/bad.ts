import { fetchViteEnv } from "nitro/vite/runtime";

export default (event: any) => fetchViteEnv("bad", event.req);
