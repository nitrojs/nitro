# AWS Lambda

> Deploy Nitro apps to AWS Lambda Event Functions or Web Functions.

Nitro has separate presets for the two ways to serve HTTP requests on Lambda:

| Preset | AWS Lambda form factor | Runtime entry |
| --- | --- | --- |
| `aws_lambda` | Event Function | Lambda event handler |
| `aws_lambda_web` | Web Function | HTTP server |

Existing `aws_lambda` deployments continue to use the Event Function preset. To deploy as a Web Function, build with `aws_lambda_web` and deploy the output as a Web Function. Lambda MicroVMs use a different execution model and are not covered by these presets.

:read-more{title="AWS Lambda" to="https://aws.amazon.com/lambda/"}

## Event Functions

**Preset:** `aws_lambda`

This preset generates output compatible with [AWS Lambda Event Functions](https://docs.aws.amazon.com/lambda/latest/dg/lambda-functions-chapter.html).
The output entrypoint in `.output/server/index.mjs` is compatible with the [AWS Lambda format](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```

### Inlining chunks

By default, Nitro output uses dynamic chunks to lazy-load code only when needed. However, this is not always ideal for performance (see the discussion in [nitrojs/nitro#650](https://github.com/nitrojs/nitro/pull/650)). You can enable chunk inlining using the [`inlineDynamicImports`](/config#inlinedynamicimports) config.

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  inlineDynamicImports: true
});
```


### Response streaming

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

## Web Functions

**Preset:** `aws_lambda_web`

AWS Lambda Web Functions run a Node.js HTTP server directly. Use the `aws-lambda-web` preset to build a Nitro app for this runtime:

```sh
NITRO_PRESET=aws-lambda-web pnpm nitro build
```

The preset listens on the host and port supplied by `AWS_LAMBDA_HTTP_ENDPOINT`. It also serves files from `.output/public`, so deploy the complete `.output` directory. With an AWS CLI version that supports `lambda-web`, you can deploy it with:

```sh
aws lambda-web deploy \
  --name my-nitro-app \
  --code .output \
  --entry-point server/index.mjs \
  --create
```

Web Functions currently use the `nodejs24.x` runtime on Arm64. Build native dependencies for Linux Arm64. For local preview, `node .output/server/index.mjs` uses Nitro's usual `NITRO_PORT` and `NITRO_HOST` settings when `AWS_LAMBDA_HTTP_ENDPOINT` is unset.

The `awsLambda.streaming` option only applies to Event Functions. Web Functions stream HTTP responses directly.

AWS Lambda Web Functions do not support WebSocket upgrades. Use server-sent events when one-way server-to-client streaming is sufficient.

Nitro's in-process scheduled task runner is disabled for this preset because a Web Function can have multiple execution environments. Use an external scheduler for recurring work.

:read-more{title="AWS Lambda Web Functions" to="https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html"}

For custom domains or AWS WAF, put CloudFront in front of the Web Function. See [AWS's guide to CloudFront origin access control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda-web.html) if you want to restrict direct access to the Web Function endpoint.
