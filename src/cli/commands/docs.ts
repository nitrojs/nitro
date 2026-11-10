import { spawn } from "node:child_process";
import { defineCommand } from "citty";

const docsOrigin = "https://nitro.build";

export default defineCommand({
  meta: {
    name: "docs",
    description: "Open Nitro documentation",
  },
  args: {
    page: { type: "positional", required: false, description: "Page path to open" },
  },
  run({ args }) {
    const url = new URL(args.page || "/", docsOrigin);
    if (url.origin !== docsOrigin) {
      throw new Error(`Invalid docs page \`${args.page}\`. Use a path such as \`/docs/routing\`.`);
    }
    console.log(`Opening ${url.href}`);
    const [cmd, cmdArgs] =
      process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url.href]]
        : [process.platform === "darwin" ? "open" : "xdg-open", [url.href]];
    const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true });
    child.on("error", (error) => {
      console.warn(`Could not open browser (${error.message}). Visit ${url.href} manually.`);
    });
    child.unref();
  },
});
