import type { Nitro } from "nitro/types";
import { resolveModulePath } from "exsolve";
import { prettyPath } from "../../utils/fs.ts";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];
const DEFAULT_DURABLE_BINDING_NAME = "$DurableObject";
const DEFAULT_DURABLE_INSTANCE_NAME = "server";

export default function cloudflareDurable(nitro: Nitro) {
  return {
    id: "#nitro/virtual/cloudflare-durable",
    template: async () => {
      const bindingName =
        nitro.options.cloudflare?.durable?.bindingName ||
        DEFAULT_DURABLE_BINDING_NAME;
      const instanceName =
        nitro.options.cloudflare?.durable?.instanceName ||
        DEFAULT_DURABLE_INSTANCE_NAME;
      const resolver = resolveDurableResolver(nitro);

      return /* js */ `
${resolver ? `export { default as resolveInstanceName } from ${JSON.stringify(resolver)};` : "export const resolveInstanceName = undefined;"}
export const bindingName = ${JSON.stringify(bindingName)};
export const instanceName = ${JSON.stringify(instanceName)};
`;
    },
  };
}

function resolveDurableResolver(nitro: Nitro) {
  const resolverPath = nitro.options.cloudflare?.durable?.resolver;
  if (!resolverPath) {
    return;
  }

  const resolverEntry = resolveModulePath(resolverPath, {
    from: nitro.options.rootDir,
    extensions: RESOLVE_EXTENSIONS,
    try: true,
  });

  if (!resolverEntry) {
    nitro.logger.warn(
      `Your custom Cloudflare durable resolver \`${prettyPath(resolverPath)}\` file does not exist.`
    );
  }

  return resolverEntry;
}
