# A GraphQL API built with nitro

This example uses the following packages:

- `@pothos/core`: For building the schema
- `graphql-yoga`: For creating a server that executes the schema
- `vite`: For building the app
- `nitro`: For serving the app

## Schema

```graphql
type Comment {
  author: User
  comment: String!
  id: ID!
  post: Post!
}

type Post {
  author: User
  comments: [Comment!]!
  content: String!
  id: ID!
  title: String!
}

type Query {
  post(id: ID!): Post
  posts(skip: Int, take: Int): [Post!]
  user(id: ID!): User
}

type User {
  comments: [Comment!]!
  firstName: String!
  fullName: String!
  id: ID!
  lastName: String!
  posts: [Post!]!
}
```
