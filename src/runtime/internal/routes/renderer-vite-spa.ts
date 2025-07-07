import { defineHandler, type EventHandler } from "h3"
import { readAsset } from "#nitro-internal-virtual/public-assets";

export default defineHandler(() => {
  return readAsset('/index.html')
}) as EventHandler
