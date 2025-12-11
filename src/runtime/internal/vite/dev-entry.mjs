import "#nitro-internal-polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { hasWebSocket } from "#nitro/virtual/feature-flags";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

export const handleUpgrade = ws?.handleUpgrade;
