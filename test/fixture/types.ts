import { expectTypeOf } from "expect-type";
import {
  type EventHandler,
  type EventHandlerRequest,
  defineEventHandler,
} from "h3";
import { defineNitroConfig } from "nitropack/config";
import type { $Fetch } from "nitropack/types";
import type { Serialize, Simplify } from "nitropack/types";
import { describe, it } from "vitest";

interface TestResponse {
  message: string;
}

const $fetch = {} as $Fetch;

describe("API routes", () => {
  const dynamicString: string = "";

  it("generates types for middleware, unknown and manual typed routes", () => {
    expectTypeOf($fetch("/")).toEqualTypeOf<Promise<unknown>>(); // middleware
    expectTypeOf($fetch("/api/unknown")).toEqualTypeOf<Promise<unknown>>();
    expectTypeOf($fetch<TestResponse>("/test")).toEqualTypeOf<
      Promise<TestResponse>
    >();
  });

  it("generates types for routes with exact matches", () => {
    expectTypeOf($fetch("/api/hello")).toEqualTypeOf<
      Promise<{ message: string }>
    >();
    expectTypeOf($fetch("/api/typed/user/john")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/john" }>
    >();
    expectTypeOf($fetch("/api/typed/user/john/post/coffee")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/john/post/coffee" }>
    >();
  });

  it("generates types for routes matching params", () => {
    expectTypeOf($fetch("/api/typed/user/{someUserId}")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/:userId" }>
    >();
    expectTypeOf(
      $fetch("/api/typed/user/{someUserId}/{extends}")
    ).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/:userId/:userExtends" }>
    >();
    expectTypeOf($fetch("/api/typed/user/john/{extends}")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/john/:johnExtends" }>
    >();
    expectTypeOf(
      $fetch("/api/typed/user/{someUserId}/post/{somePostId}")
    ).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/:userId/post/:postId" }>
    >();
  });

  it("generates types for routes (w/o dynamic template literal) and with param and exact matches", () => {
    expectTypeOf(
      $fetch("/api/typed/user/john/post/{somePostId}")
    ).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/john/post/:postId" }>
    >();
    expectTypeOf(
      $fetch(`/api/typed/user/${dynamicString}/post/firstPost`)
    ).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/:userId/post/firstPost" }>
    >();
    expectTypeOf($fetch(`/api/typed/user/${dynamicString}`)).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/user/john" }
        | { internalApiKey: "/api/typed/user/:userId" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/user/john/post/${dynamicString}`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/user/john/post/coffee" }
        | { internalApiKey: "/api/typed/user/john/post/:postId" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/user/{someUserId}/post/${dynamicString}`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/user/:userId/post/:postId" }
        | { internalApiKey: "/api/typed/user/:userId/post/firstPost" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/user/${dynamicString}/post/${dynamicString}`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/user/john/post/coffee" }
        | { internalApiKey: "/api/typed/user/john/post/:postId" }
        | { internalApiKey: "/api/typed/user/:userId/post/:postId" }
        | { internalApiKey: "/api/typed/user/:userId/post/firstPost" }
      >
    >();
  });

  it("generates types for routes matching prefix", () => {
    expectTypeOf($fetch("/api/hey/**")).toEqualTypeOf<Promise<string>>();
    expectTypeOf($fetch("/api/param/{id}/**")).toEqualTypeOf<Promise<string>>();
    expectTypeOf(
      $fetch("/api/typed/user/{someUserId}/post/{somePostId}/**")
    ).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/:userId/post/:postId" }>
    >();
    expectTypeOf($fetch("/api/typed/user/john/post/coffee/**")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/user/john/post/coffee" }>
    >();
    expectTypeOf(
      $fetch(`/api/typed/user/${dynamicString}/post/${dynamicString}/**`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/user/john/post/coffee" }
        | { internalApiKey: "/api/typed/user/john/post/:postId" }
        | { internalApiKey: "/api/typed/user/:userId/post/:postId" }
        | { internalApiKey: "/api/typed/user/:userId/post/firstPost" }
      >
    >();
  });

  it("ignores query suffixes", () => {
    expectTypeOf($fetch("/api/hey?test=true")).toEqualTypeOf<Promise<string>>();
    expectTypeOf($fetch("/api/hello?")).toEqualTypeOf<
      Promise<{ message: string }>
    >();
  });

  it("generates types for routes matching Api keys with /** globs", () => {
    expectTypeOf($fetch("/api/wildcard/foo/bar")).toEqualTypeOf<
      Promise<string>
    >();
    expectTypeOf($fetch("/api/typed/todos/parent/child")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/todos/**" }>
    >();
    expectTypeOf(
      $fetch(`/api/typed/todos/${dynamicString}/child`)
    ).toEqualTypeOf<Promise<{ internalApiKey: "/api/typed/todos/**" }>>();
    expectTypeOf(
      $fetch(`/api/typed/todos/some/deeply/nest/${dynamicString}/path`)
    ).toEqualTypeOf<Promise<{ internalApiKey: "/api/typed/todos/**" }>>();
    expectTypeOf(
      $fetch("/api/typed/todos/firstTodo/comments/foo")
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/todos/**" }
        | { internalApiKey: "/api/typed/todos/:todoId/comments/**:commentId" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/todos/firstTodo/comments/${dynamicString}`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/todos/**" }
        | { internalApiKey: "/api/typed/todos/:todoId/comments/**:commentId" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/todos/${dynamicString}/${dynamicString}/foo/bar/baz`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/todos/**" }
        | { internalApiKey: "/api/typed/todos/:todoId/comments/**:commentId" }
      >
    >();
    expectTypeOf(
      $fetch(`/api/typed/catchall/${dynamicString}/foo/bar/baz`)
    ).toEqualTypeOf<
      Promise<
        | { internalApiKey: "/api/typed/catchall/:slug/**:another" }
        | { internalApiKey: "/api/typed/catchall/some/**:test" }
      >
    >();
    expectTypeOf($fetch("/api/typed/catchall/some/foo/bar/baz")).toEqualTypeOf<
      Promise<{ internalApiKey: "/api/typed/catchall/some/**:test" }>
    >();
  });

  it("generates the correct type depending on the method used", () => {
    expectTypeOf($fetch("/api/methods")).toEqualTypeOf<Promise<"Index get">>();
    expectTypeOf($fetch("/api/methods", {})).toEqualTypeOf<
      Promise<"Index get">
    >();
    expectTypeOf($fetch("/api/methods", { query: {} })).toEqualTypeOf<
      Promise<"Index get">
    >();
    expectTypeOf($fetch("/api/methods", { method: "get" })).toEqualTypeOf<
      Promise<"Index get">
    >();
    expectTypeOf($fetch("/api/methods", { method: "post" })).toEqualTypeOf<
      Promise<"Index post">
    >();
    expectTypeOf(
      $fetch("/api/methods/default", { method: "GET" })
    ).toEqualTypeOf<Promise<"Default route">>();
    expectTypeOf(
      $fetch("/api/methods/default", { method: "PUT" })
    ).toEqualTypeOf<Promise<"Default route">>();
    expectTypeOf(
      $fetch("/api/methods/default", { method: "POST" })
    ).toEqualTypeOf<Promise<"Default override">>();
  });

  it("generates types matching JSON serialization output", () => {
    expectTypeOf($fetch("/api/serialized/date")).toEqualTypeOf<
      Promise<{
        createdAt: string;
      }>
    >();

    expectTypeOf($fetch("/api/serialized/error")).toEqualTypeOf<
      Promise<{
        statusCode: number;
        statusMessage?: string;
        data?: NonNullable<unknown>;
        message: string;
      }>
    >();

    expectTypeOf($fetch("/api/serialized/void")).toEqualTypeOf<
      Promise<unknown>
    >();

    expectTypeOf($fetch("/api/serialized/null")).toEqualTypeOf<Promise<any>>();

    expectTypeOf($fetch("/api/serialized/function")).toEqualTypeOf<
      Promise<{}>
    >();

    expectTypeOf($fetch("/api/serialized/map")).toEqualTypeOf<
      Promise<{
        foo: Record<string, never>;
      }>
    >();

    expectTypeOf($fetch("/api/serialized/set")).toEqualTypeOf<
      Promise<{
        foo: Record<string, never>;
      }>
    >();

    expectTypeOf($fetch("/api/serialized/tuple")).toEqualTypeOf<
      Promise<[string, string]>
    >();
  });
});

describe("defineNitroConfig", () => {
  it("should not accept functions to routeRules.cache", () => {
    defineNitroConfig({
      compatibilityDate: "latest",
      routeRules: {
        "/**": {
          cache: {
            // @ts-expect-error
            shouldBypassCache(event) {
              return false;
            },
          },
        },
      },
    });
  });
});

async function fixture() {
  await Promise.resolve();
  return {
    message: "Hello world",
  };
}

describe("defineCachedEventHandler", () => {
  it("should infer return type", () => {
    const a = defineCachedEventHandler(fixture);
    const b = defineEventHandler(fixture);
    expectTypeOf(a).toEqualTypeOf(b);
    expectTypeOf(b).toEqualTypeOf<
      EventHandler<
        EventHandlerRequest,
        Promise<{
          message: string;
        }>
      >
    >();
  });
  it("should not allow typed input body", () => {
    const b = defineCachedEventHandler<
      { body: string },
      Promise<{ message: string }>
    >(fixture);
    expectTypeOf(b).toEqualTypeOf<
      EventHandler<{}, Promise<{ message: string }>>
    >();
  });
  it("is backwards compatible with old generic signature", () => {
    // prettier-ignore
    const a =
      defineCachedEventHandler<
        Promise<{
          message: string;
        }>
      >(fixture);
    const b = defineEventHandler(fixture);
    expectTypeOf(a).toEqualTypeOf(b);
    expectTypeOf(b).toEqualTypeOf<
      EventHandler<
        EventHandlerRequest,
        Promise<{
          message: string;
        }>
      >
    >();
  });
});

describe("type helpers", () => {
  it("Serialize", () => {
    expectTypeOf<Serialize<undefined>>().toEqualTypeOf<undefined>();
    expectTypeOf<Serialize<{ test?: string }>>().toEqualTypeOf<{
      test?: string;
    }>();
    expectTypeOf<Serialize<{ test: Date }>>().toEqualTypeOf<{ test: string }>();
    expectTypeOf<Serialize<{ test?: Date }>>().toEqualTypeOf<{
      test?: string;
    }>();
    expectTypeOf<Serialize<{ test: Map<string, string> }>>().toEqualTypeOf<{
      test: Record<string, never>;
    }>();
    expectTypeOf<
      Serialize<{ nested: { test: Map<string, string> } }>
    >().toEqualTypeOf<{ nested: { test: Record<string, never> } }>();
  });

  it("Simplify", () => {
    expectTypeOf<Simplify<Serialize<{ test: Date }>>>().toEqualTypeOf<{
      test: string;
    }>();
    expectTypeOf<
      Simplify<Serialize<{ test: Map<string, string> }>>
    >().toEqualTypeOf<{ test: Record<string, never> }>();
    expectTypeOf<
      Simplify<Serialize<{ nested: { test: Map<string, string> } }>>
    >().toEqualTypeOf<{ nested: { test: Record<string, never> } }>();
  });
});
