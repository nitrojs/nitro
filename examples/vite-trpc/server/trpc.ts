import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

let counter = 0;

const t = initTRPC.create();

export const appRouter = t.router({
  get: t.procedure.query(() => {
    return { value: counter };
  }),

  inc: t.procedure.mutation(() => {
    counter++;
    return { value: counter };
  }),
});

export type AppRouter = typeof appRouter;

export default {
  async fetch(request: Request): Promise<Response> {
    return fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
    });
  },
};
