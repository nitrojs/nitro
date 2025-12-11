import "#nitro-internal-polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#runtime/app";
import { hasWebSocket } from "#nitro-internal-virtual/feature-flags";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

export const handleUpgrade = ws?.handleUpgrade;
