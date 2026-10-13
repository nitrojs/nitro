// Worker => Host RPC for the dev server.
// Plain `.mjs` so the vite dev worker can load it unbundled (e.g. in workerd).

/**
 * @param {(message: unknown) => void} sendMessage
 */
export function createDevRPC(sendMessage) {
  /** @type {Map<string, { resolve: (data: any) => void, reject: (error: unknown) => void, timer: any }>} */
  const requests = new Map();

  return {
    /**
     * @param {string} name
     * @param {unknown} [data]
     * @returns {Promise<any>}
     */
    call(name, data, timeout = 3000) {
      const id = Math.random().toString(36).slice(2);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          requests.delete(id);
          reject(new Error(`RPC "${name}" timed out`));
        }, timeout);
        requests.set(id, { resolve, reject, timer });
        sendMessage({ __rpc: name, __rpc_id: id, data });
      });
    },
    /**
     * Returns `true` when the message is an RPC reply.
     * @param {any} message
     */
    handleMessage(message) {
      if (!message?.__rpc_id) {
        return false;
      }
      const request = requests.get(message.__rpc_id);
      if (request) {
        clearTimeout(request.timer);
        requests.delete(message.__rpc_id);
        if (message.error) {
          request.reject(
            typeof message.error === "string" ? new Error(message.error) : message.error
          );
        } else {
          request.resolve(message.data);
        }
      }
      return true;
    },
  };
}
