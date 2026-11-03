import type { NitroRsbuildContext } from "./_context.ts";
import { useNitro } from "./_context.ts";
import { collectClientAssets } from "./_assets.ts";

/**
 * Collects the outputs of the client environments used by the server (assets of `?assets` imports
 * and page HTML), embedded in virtual modules. In development, the first server build waits for the
 * clients, and the server is rebuilt when they change.
 */
export function setupClientOutputs(ctx: NitroRsbuildContext) {
  const nitro = useNitro(ctx);
  const clientAssets: NonNullable<NitroRsbuildContext["clientAssets"]> = (ctx.clientAssets = {});
  const firstBuilds = ctx.clientEnvs.map((env) => {
    const compiler = ctx.compilers?.find((c) => c.name === env);
    if (!compiler) {
      return;
    }
    let onFirstBuild: (() => void) | undefined;
    const firstBuild = new Promise<void>((resolve) => (onFirstBuild = resolve));
    compiler.hooks.done.tap("nitro:client", (stats) => {
      if (!stats.hasErrors()) {
        const assets = collectClientAssets(stats, nitro.options.rootDir);
        const html =
          ctx.pageTemplate && env === ctx.clientEnvs[0]
            ? stats.compilation.getAsset("index.html")?.source.source().toString()
            : ctx.pageHTML;
        const changed =
          JSON.stringify(assets) !== JSON.stringify(clientAssets[env]) || html !== ctx.pageHTML;
        clientAssets[env] = assets;
        ctx.pageHTML = html;
        if (changed && ctx.dev && !onFirstBuild) {
          ctx.devWatch?.rebuild();
        }
      }
      onFirstBuild?.();
      onFirstBuild = undefined;
    });
    return firstBuild;
  });
  if (ctx.dev) {
    ctx.compiler?.hooks.watchRun.tapPromise({ name: "nitro:client", stage: -100 }, () =>
      Promise.all(firstBuilds).then(() => {})
    );
  }
}
