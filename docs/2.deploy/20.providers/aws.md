# AWS Lambda

> Deploy Nitro apps to AWS Lambda.

**Preset:** `aws_lambda`

:read-more{title="AWS Lambda" to="https://aws.amazon.com/lambda/"}

Nitro provides a built-in preset to generate output format compatible with [AWS Lambda](https://aws.amazon.com/lambda/).
The output entrypoint in `.output/server/index.mjs` is compatible with [AWS Lambda format](https://docs.aws.amazon.com/lex/latest/dg/lambda-input-response-format.html).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```

## Inlining chunks

Nitro output, by default uses dynamic chunks for lazy loading code only when needed. However this sometimes can not be ideal for performance. (See discussions in [nitrojs/nitro#650](https://github.com/nitrojs/nitro/pull/650)). You can enabling chunk inlining behavior using [`inlineDynamicImports`](/config#inlinedynamicimports) config.

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
  inlineDynamicImports: true
});
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    inlineDynamicImports: true
  }
})
```

::


## Response streaming

:read-more{title="Introducing AWS Lambda response streaming" to="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"}

In order to enable response streaming, enable `awsLambda.streaming` flag:

```ts [nitro.config.ts]
export default defineNitroConfig({
  awsLambda: {
    streaming: true
  }
});
```
