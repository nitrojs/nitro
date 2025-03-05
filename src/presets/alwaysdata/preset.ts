import { defineNitroPreset } from "nitro/kit";

const alwaysdata = defineNitroPreset(
  {
    extends: "node-server",
    commands: {
      deploy:
        "rsync -rRt --info=progress2 ./ [account]@ssh-[account].alwaysdata.net:www/my-app",
    },
  },
  {
    name: "alwaysdata" as const,
    url: import.meta.url,
  }
);

export default [alwaysdata] as const;
