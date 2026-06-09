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
