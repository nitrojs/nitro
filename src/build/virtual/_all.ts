import type { Nitro } from "nitro/types";

import database from "./database.ts";
import errorHandler from "./error-handler.ts";
import featureFlags from "./feature-flags.ts";
import plugins from "./plugins.ts";
import polyfills from "./polyfills.ts";
import publicAssets from "./public-assets.ts";
import rendererTemplate from "./renderer-template.ts";
import routingMeta from "./routing-meta.ts";
import routing from "./routing.ts";
import runtimeConfig from "./runtime-config.ts";
import serverAssets from "./server-assets.ts";
import storage from "./storage.ts";
import tasks from "./tasks.ts";

type VirtualTemplate = {
  id: string;
  template: string | (() => string | Promise<string>);
};

export function virtualTemplates(nitro: Nitro, _polyfills: string[]): VirtualTemplate[] {
  const nitroTemplates = [
    database,
    errorHandler,
    featureFlags,
    plugins,
    polyfills,
    publicAssets,
    rendererTemplate,
    routingMeta,
    routing,
    runtimeConfig,
    serverAssets,
    storage,
    tasks,
  ].flatMap((t) => t(nitro, _polyfills));

  const customTemplates = Object.entries(nitro.options.virtual).map(([id, template]) => ({
    id,
    template,
  }));

  return [...nitroTemplates, ...customTemplates];
}
