import clientAssets from "./entry-client.ts?assets=client";

export default {
  fetch() {
    return new Response(
      `<h1>renderer</h1><script type="module" src="${clientAssets.entry}"></script>`,
      {
        headers: { "content-type": "text/html" },
      }
    );
  },
};
