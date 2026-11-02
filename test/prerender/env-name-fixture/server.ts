import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  fetch() {
    const { target } = useRuntimeConfig();
    return new Response(
      `<!DOCTYPE html><html><body>${import.meta.envName} ${target}</body></html>`,
      {
        headers: { "content-type": "text/html" },
      }
    );
  },
};
