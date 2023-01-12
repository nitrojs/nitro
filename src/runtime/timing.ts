import { eventHandler } from "h3";

import { defineNitroPlugin } from "./plugin";

export const globalTiming = globalThis.__timing__ || {
  start: () => 0,
  end: () => 0,
  metrics: [],
};

export const timingPlugin = defineNitroPlugin((nitro) => {
  nitro.h3App.use(
    eventHandler((event) => {
      const start = globalTiming.start();

      const _end = event.res.end;
      event.res.end = function (
        chunk: any,
        encoding: BufferEncoding,
        cb?: () => void
      ) {
        const metrics = [
          ["Generate", globalTiming.end(start)],
          ...globalTiming.metrics,
        ];
        const serverTiming = metrics
          .map((m) => `-;dur=${m[1]};desc="${encodeURIComponent(m[0])}"`)
          .join(", ");
        if (!event.res.headersSent) {
          event.res.setHeader("Server-Timing", serverTiming);
        }
        _end.call(event.res, chunk, encoding, cb);
        return this;
      }.bind(event.res);
    })
  );
});
