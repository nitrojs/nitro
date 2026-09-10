export function augmentDevRequest(request, { env, context }) {
  if (!env || !context?.waitUntil) {
    return;
  }

  globalThis.__env__ = env;
  request.ip = request.headers.get("cf-connecting-ip") || undefined;
  request.runtime ??= { name: "cloudflare" };
  request.runtime.cloudflare = { ...request.runtime.cloudflare, env, context };
  request.waitUntil = context.waitUntil.bind(context);
}
