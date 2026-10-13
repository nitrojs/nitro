import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";

export const auth = betterAuth({
  database: new DatabaseSync("./auth.sqlite"),
  emailAndPassword: { enabled: true },
  secret: "supersecretkey",
});

// export const fetch = auth.handler;

export default { fetch: auth.handler };
