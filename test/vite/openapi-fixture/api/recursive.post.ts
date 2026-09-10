import { defineValidatedHandler } from "nitro/h3";
import { z } from "zod";

interface TreeNode {
  name: string;
  children?: TreeNode[];
}

const Tree: z.ZodType<TreeNode> = z.object({
  name: z.string(),
  children: z.array(z.lazy(() => Tree)).optional(),
});

export default defineValidatedHandler({
  validate: { body: Tree, query: Tree, headers: Tree },
  handler: () => ({ ok: true }),
});
