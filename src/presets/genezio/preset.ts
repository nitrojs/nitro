import { defineNitroPreset } from "../_utils/preset";

const genezio = defineNitroPreset(
  {
    extends: "aws_lambda",
  },
  {
    name: "genezio" as const,
  }
);
export default [genezio] as const;
