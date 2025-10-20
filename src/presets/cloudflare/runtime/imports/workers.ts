export const env = new Proxy(
  {},
  {
    get(_target, prop) {
      return globalThis.__env__?.[prop as keyof typeof globalThis.__env__];
    },

    has(_target, prop) {
      return globalThis.__env__ ? prop in globalThis.__env__ : false;
    },

    ownKeys(_target) {
      return globalThis.__env__ ? Object.keys(globalThis.__env__) : [];
    },

    getOwnPropertyDescriptor(_target, prop) {
      return globalThis.__env__
        ? Object.getOwnPropertyDescriptor(globalThis.__env__, prop)
        : undefined;
    },
  }
);

// TODO: waitUntil, WorkerEntrypoint, DurableObject
