import { defineHandler, setServerTiming } from "nitro/h3";

export default defineHandler((event) => {
  if (/^\/(rules\/swr\/)?server-timing\/cached\//.test(event.url.pathname)) {
    setServerTiming(event, "mw", { dur: 1 });
  }
});
