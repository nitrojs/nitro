import type { NitroAppPlugin } from "nitro/types";

let _cfModule: { env: Record<string, unknown>; waitUntil?: (p: Promise<unknown>) => void } | undefined;

async function getCfModule() {
  if (!_cfModule) {
    try {
      const cf = await import("cloudflare:workers");
      _cfModule = { env: cf.env as unknown as Record<string, unknown>, waitUntil: cf.waitUntil };
    } catch {
      _cfModule = { env: {} };
    }
    (globalThis as any).__env__ = _cfModule.env;
    (globalThis as any).__wait_until__ = _cfModule.waitUntil;
  }
  return _cfModule;
}

const cloudflareDevPlugin: NitroAppPlugin = function (nitroApp) {
  nitroApp.hooks.hook("request", async (event) => {
    const cf = await getCfModule();
    const request = event.req;

    (request as any).runtime ??= { name: "cloudflare" };
    (request as any).runtime.cloudflare = {
      ...(request as any).runtime.cloudflare,
      env: cf.env,
    };
    (request as any).waitUntil = cf.waitUntil;
  });

  // https://github.com/pi0/nitro-cloudflare-dev/issues/5
  // https://github.com/unjs/hookable/issues/98
  // @ts-expect-error
  nitroApp.hooks._hooks.request.unshift(nitroApp.hooks._hooks.request.pop());
};

export default cloudflareDevPlugin;
