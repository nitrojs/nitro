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
