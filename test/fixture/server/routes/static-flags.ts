export default async () => {
  return {
    dev: [process.dev, import.meta.dev],
    preset: [process.preset, import.meta.preset],
    prerender: [process.prerender, import.meta.prerender],
    server: [process.server, import.meta.server],
    client: [process.client, import.meta.client],
    nitro: [process.nitro, import.meta.nitro],
    "versions.nitro": [process.versions.nitro, import.meta.versions?.nitro],
    "versions?.nitro": [process.versions?.nitro, import.meta.versions?.nitro],
  };
};
