import { defineNitroPreset } from "nitro/kit";

const genezio = defineNitroPreset(
  {
    extends: "aws_lambda",
  },
  {
    name: "genezio" as const,
    url: import.meta.url,
  }
);
export default [genezio] as const;
