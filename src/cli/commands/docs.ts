import { execSync } from "node:child_process";
import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "docs",
    description: "Open Nitro documentation",
  },
  args: {
    page: { type: "positional", required: false, description: "Page path to open" },
  },
  run({ args }) {
    const url = new URL(args.page || "/", "https://nitro.build").href;
    console.log(`Opening ${url}`);
    const cmd =
      process.platform === "win32"
        ? `start "" "${url}"`
        : `${process.platform === "darwin" ? "open" : "xdg-open"} "${url}"`;
    try {
      execSync(cmd, { stdio: "ignore" });
    } catch {}
  },
});
