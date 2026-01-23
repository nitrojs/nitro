import "#nitro/virtual/polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

export const handleUpgrade = ws?.handleUpgrade;
