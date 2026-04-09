Build a GraphQL API using Pothos for schema definition and GraphQL Yoga for request handling. This example demonstrates type-safe schema construction with Pothos object refs and field resolvers, served through Nitro's file-based routing.

## GraphQL Route

```ts [server/routes/graphql.ts]
import { createYoga } from "graphql-yoga";
import { defineEventHandler, defineLazyEventHandler, type H3Event } from "nitro/h3";
import { schema } from "../graphql/schema";

export default defineLazyEventHandler(() => {
  const yoga = createYoga<{ event: H3Event }>({
    schema,
    fetchAPI: { Response },
  });

  return defineEventHandler((event) => {
    return yoga.handleRequest(event.req, { event });
  });
});
```

The route uses `defineLazyEventHandler` to create the Yoga instance once and reuse it across requests. The GraphQL endpoint is available at `/graphql`.

## Schema Builder

```ts [server/graphql/builder.ts]
import SchemaBuilder from "@pothos/core";
import type { H3Event } from "nitro/h3";

export const builder = new SchemaBuilder<{
  Context: { event: H3Event };
}>({});
builder.queryType({});
```

Create a typed schema builder with the H3 event in context. Schema files are auto-loaded via `import.meta.glob`:

```ts [server/graphql/schema.ts]
import { builder } from "./builder";

import.meta.glob("./schema/**/*.ts", { eager: true });

export const schema = builder.toSchema();
```

## Defining Types

Each type is defined in its own file using Pothos object refs:

```ts [server/graphql/schema/post.ts]
import { Comments, type IPost, Posts, Users } from "../../utils/data";
import { builder } from "../builder";
import { Comment } from "./comment";
import { User } from "./user";

export const Post = builder.objectRef<IPost>("Post");

Post.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    content: t.exposeString("content"),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (post) => [...Users.values()].find((user) => user.id === post.authorId),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (post) => [...Comments.values()].filter((comment) => comment.postId === post.id),
    }),
  }),
});

builder.queryFields((t) => ({
  post: t.field({
    type: Post,
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_root, args) => Posts.get(String(args.id)),
  }),
}));
```

Use `builder.objectRef` to bind TypeScript types to GraphQL types, then implement fields with resolvers. Use `builder.queryFields` to define the entry points for fetching data.
