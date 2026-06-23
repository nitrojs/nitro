# AWS Lambda

> Deploy Nitro apps to AWS Lambda.

**Preset:** `aws_lambda`

:read-more{title="AWS Lambda" to="https://aws.amazon.com/lambda/"}

Nitro provides a built-in preset to generate output format compatible with [AWS Lambda](https://aws.amazon.com/lambda/).
The output entrypoint in `.output/server/index.mjs` is an [AWS Lambda function handler](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```

## Supported event types

The following [@types/aws-lambda](https://www.npmjs.com/package/@types/aws-lambda) event types are supported:

- `ALBEvent`: ALB (Application Load Balancer) [Lambda target group](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html).
- `APIGatewayProxyEvent`: API Gateway REST [Lambda proxy integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html) or API Gateway HTTP [Lambda integration with 1.0 payload format](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).
- `APIGatewayProxyEventV2`: API Gateway HTTP [Lambda integration with 2.0 payload format](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).
- `LambdaFunctionURLEvent`: Lambda [function URL](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html).

_Note:_ API Gateway REST [Lambda custom integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-custom-integrations.html) are not supported.

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
