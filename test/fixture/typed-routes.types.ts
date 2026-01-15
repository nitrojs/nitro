import type { AvailableRouterMethod, TypedInternalResponse } from "nitro/types";

type UsersGet = { users: string[] };
type UsersPost = { created: true };
type UserById = { id: string };
type FilesGet = { path: string };

declare module "nitro/types" {
  interface InternalApi {
    api: {
      users: {
        $: {
          get: UsersGet;
          post: UsersPost;
        };
        ":id": {
          $: {
            get: UserById;
          };
        };
      };
      files: {
        "**": {
          $: {
            get: FilesGet;
          };
        };
      };
    };
  }
}

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

export type TypedUsersGet = Expect<
  Equal<TypedInternalResponse<"/api/users", unknown, "get">, UsersGet>
>;
export type TypedUsersPost = Expect<
  Equal<TypedInternalResponse<"/api/users", unknown, "post">, UsersPost>
>;
export type TypedUserId = Expect<
  Equal<TypedInternalResponse<"/api/users/123", unknown, "get">, UserById>
>;
export type TypedFiles = Expect<
  Equal<TypedInternalResponse<"/api/files/a/b", unknown, "get">, FilesGet>
>;
export type TypedUsersMethods = Expect<
  Equal<AvailableRouterMethod<"/api/users">, "get" | "post">
>;
