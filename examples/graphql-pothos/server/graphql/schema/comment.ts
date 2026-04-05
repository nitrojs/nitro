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
