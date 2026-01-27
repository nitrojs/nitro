import { defineNitroPreset } from "../_utils/preset.ts";

const alwaysdata = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    commands: {
      deploy: "rsync -rRt --info=progress2 ./ [account]@ssh-[account].alwaysdata.net:www/my-app",
    },
  },
  {
    name: "alwaysdata" as const,
  }
);

export default [alwaysdata] as const;
