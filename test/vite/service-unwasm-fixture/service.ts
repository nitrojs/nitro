import { highlight } from "@fixture/unwasm-dep";

export default {
  async fetch() {
    return new Response(await highlight());
  },
};
