import { fetch } from "./helper.ts";

// The named `fetch` export must not shadow the `default` export's handler.
export { fetch };

export default {
  prefix: "rendered:",
  async fetch(req: Request) {
    const { render } = await import("./lazy.ts");
    return new Response(this.prefix + render(req.url) + ":" + typeof fetch);
  },
};
