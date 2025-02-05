export default eventHandler(async (event) => {
  const nitroApp = useNitroApp();
  return {
    $fetch: await fetch("/api/hey").then((r) => r.text()),
    "event.fetch": await event.fetch("/api/hey").then((r) => r.text()),
    "event.$fetch": await event.$fetch("/api/hey"),
    "nitroApp.localFetch": await nitroApp
      .localFetch("/api/hey")
      .then((r) => r.text()),
    "nitroApp.localCall": await nitroApp
      .localCall({ url: "/api/hey" })
      .then((r) => r.body),
  };
});
