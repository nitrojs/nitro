export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hookOnce("close", async () => {
    console.log("Disconnecting database...");

    // something you want to do, such like disconnect the database, or wait until the task is done
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Database is disconnected!");
  });
});
