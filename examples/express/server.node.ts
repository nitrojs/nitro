import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Nitro!");
});

export default app;
