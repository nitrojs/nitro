export default defineHandler(async (event) => {
  const nitroApp = useNitroApp();
  return {
    $fetch: await fetch("/api/hey").then((r) => r.text()),
    // Removed in v3
    // "event.fetch": await event.fetch("/api/hey").then((r) => r.text()),
    // "event.$fetch": await event.$fetch("/api/hey"),
    "nitroApp.localFetch": await nitroApp
      .fetch("/api/hey")
      .then((r) => r.text()),
  };
});
