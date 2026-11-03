import clientAssets from "./entry-client.ts?assets=client";

// Another environment importing the same `?assets` module as the ssr entry
export default {
  fetch() {
    return Response.json(clientAssets);
  },
};
