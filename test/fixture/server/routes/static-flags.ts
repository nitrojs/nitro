export default async () => {
  return {
    dev: import.meta.dev,
    envName: import.meta.envName,
    preset: import.meta.preset,
    prerender: import.meta.prerender,
    nitro: import.meta.nitro,
    server: import.meta.server,
    client: import.meta.client,
    baseURL: import.meta.baseURL,
    _asyncContext: import.meta._asyncContext,
    _tasks: import.meta._tasks,
  };
};
