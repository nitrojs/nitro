# AWS Lambda

> Deploy Nitro apps to AWS Lambda.

**Preset:** `aws_lambda`

:read-more{title="AWS Lambda" to="https://aws.amazon.com/lambda/"}

Nitro provides a built-in preset to generate output compatible with [AWS Lambda](https://aws.amazon.com/lambda/).
The output entrypoint in `.output/server/index.mjs` is compatible with the [AWS Lambda format](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```

## Inlining chunks

By default, Nitro output uses dynamic chunks to lazy-load code only when needed. However, this is not always ideal for performance (see the discussion in [nitrojs/nitro#650](https://github.com/nitrojs/nitro/pull/650)). You can enable chunk inlining using the [`inlineDynamicImports`](/config#inlinedynamicimports) config.

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  inlineDynamicImports: true
});
```


## Response streaming

:read-more{title="Introducing AWS Lambda response streaming" to="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"}

To enable response streaming, set the `awsLambda.streaming` flag:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  awsLambda: {
    streaming: true
  }
});
```
