import { definePlugin } from "nitro";

export default definePlugin(() => {});

// --- debug tracing channels ---

debugChannel("srvx.middleware");
debugChannel("srvx.fetch");
debugChannel("h3.fetch");

function debugChannel(name: string) {
  const { tracingChannel } = process.getBuiltinModule("node:diagnostics_channel");

  const log = (...args: unknown[]) => console.log(`[tracing:${name}]`, ...args);
  const noop = () => {};
  const serializeData = (data: any) =>
    Object.entries(data)
      .map(([key, value]) => {
        if (!value) {
          value = String(value);
        } else if (value instanceof Response) {
          value = `Response(${value.status} ${value.statusText})`;
        } else if (typeof value === "object") {
          value = `{${Object.keys(value).join(",")}}`;
        }
        return `${key}=${value}`;
      })
      .join(", ");

  tracingChannel(name).subscribe({
    start: noop,
    end: noop,
    asyncStart: (data) => log("asyncStart", serializeData(data)),
    asyncEnd: (data) => log("asyncEnd", serializeData(data)),
    error: (data) => log("error", serializeData(data)),
  });
}
