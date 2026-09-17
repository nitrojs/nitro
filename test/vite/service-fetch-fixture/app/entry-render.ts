import { fetch } from "./helper.ts";

// #4606: a `default` export without a `fetch` handler (the helper must not be used instead)
export default {
  async render() {
    const { render } = await import("./lazy.ts");
    return render("page") + typeof fetch;
  },
};
