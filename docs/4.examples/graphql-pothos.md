---
category: integrations
icon: i-simple-icons-graphql
---

# GraphQL with Pothos

> Build a type-safe GraphQL API using Pothos for schema definition and GraphQL Yoga for request handling.

<!-- automd:ui-code-tree src="../../examples/graphql-pothos" default="server/routes/graphql.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server/routes/graphql.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
});
```

```json [package.json]
{
  "name": "@pothos-examples/nitro",
  "version": "3.1.22",
  "private": true,
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "start": "node .output/server/index.mjs",
    "type": "tsc --noEmit"
  },
  "dependencies": {
    "@faker-js/faker": "^10.1.0",
    "@pothos/core": "^4.12.0",
    "graphql": "^16.10.0",
    "graphql-yoga": "5.17.1"
  },
  "devDependencies": {
    "nitro": "^3.0.1-alpha.2",
    "vite": "^8.0.0-beta.16"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [nitro()],
});
```

```ts [server/graphql/builder.ts]
import SchemaBuilder from "@pothos/core";
import type { H3Event } from "nitro/h3";

export const builder = new SchemaBuilder<{
  Context: { event: H3Event };
}>({});
builder.queryType({});
// builder.mutationType({})
// builder.subscriptionType({})

// Do not include in production
if (import.meta.dev) {
  // Tell vite to reload the builder when schema changes
  // https://github.com/hayes/pothos/issues/49#issuecomment-836056530
  import("./schema");
}
```

```ts [server/graphql/schema.ts]
import { builder } from "./builder";

// Run all side effects to add the fields
import.meta.glob("./schema/**/*.ts", { eager: true });

export const schema = builder.toSchema();
```

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

```ts [server/utils/data.ts]
import { faker } from "@faker-js/faker";

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface IPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
}

export interface IComment {
  id: string;
  postId: string;
  authorId: string;
  comment: string;
}

export const Users = new Map<string, IUser>();
export const Posts = new Map<string, IPost>();
export const Comments = new Map<string, IComment>();

faker.seed(123);

// Create 100 users, posts and comments
for (let i = 1; i <= 100; i += 1) {
  Users.set(String(i), {
    id: String(i),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  });

  Posts.set(String(i), {
    id: String(i),
    authorId: String(faker.number.int({ min: 1, max: 100 })),
    title: faker.lorem.text(),
    content: faker.lorem.paragraphs(2),
  });

  Comments.set(String(i), {
    id: String(i),
    authorId: String(faker.number.int({ min: 1, max: 100 })),
    postId: String(faker.number.int({ min: 1, max: 100 })),
    comment: faker.lorem.text(),
  });
}
```

```ts [server/graphql/schema/comment.ts]
import { type IComment, Posts, Users } from "../../utils/data";
import { builder } from "../builder";
import { Post } from "./post";
import { User } from "./user";

export const Comment = builder.objectRef<IComment>("Comment");

Comment.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    comment: t.exposeString("comment"),
    author: t.field({
      type: User,
      nullable: true,
      resolve: (comment) => [...Users.values()].find((user) => user.id === comment.authorId),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) => [...Posts.values()].find((post) => post.id === comment.postId),
    }),
  }),
});
```

```ts [server/graphql/schema/post.ts]
import { Comments, type IPost, Posts, Users } from "../../utils/data";
import { builder } from "../builder";
import { Comment } from "./comment";
import { User } from "./user";

const DEFAULT_PAGE_SIZE = 10;

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


  posts: t.field({
    type: [Post],
    nullable: true,
    args: {
      take: t.arg.int(),
      skip: t.arg.int(),
    },
    resolve: (_root, { skip, take }) =>
      [...Posts.values()].slice(skip ?? 0, (skip ?? 0) + (take ?? DEFAULT_PAGE_SIZE)),
  }),
}));
```

```ts [server/graphql/schema/user.ts]
import { Comments, type IUser, Posts, Users } from "../../utils/data";
import { builder } from "../builder";
import { Comment } from "./comment";
import { Post } from "./post";

export const User = builder.objectRef<IUser>("User");

User.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.field({
      type: [Post],
      resolve: (user) => [...Posts.values()].filter((post) => post.authorId === user.id),
    }),
    comments: t.field({
      type: [Comment],
      resolve: (user) => [...Comments.values()].filter((comment) => comment.authorId === user.id),
    }),
  }),
});

builder.queryFields((t) => ({
  user: t.field({
    type: User,
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_root, args) => Users.get(String(args.id)),
  }),
}));
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/graphql-pothos/README.md" -->

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

<!-- /automd -->

## Learn More

- [Pothos Documentation](https://pothos-graphql.dev/)
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [Routing](/docs/routing)
