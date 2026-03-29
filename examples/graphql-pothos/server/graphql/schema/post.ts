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
