import { H3Event, HTTPError } from "nitro/h3";

export default ({ url }: H3Event) => {
  const unhandled = url.searchParams.has("unhandled");
  const shouldThrow = url.searchParams.get("action") === "throw";

  const error = unhandled
    ? new Error("Unhandled error")
    : new HTTPError({
        status: 503,
        statusText: "Custom Status Text",
        message: "Handled error",
        headers: { "x-custom-error": "custom-value" },
        data: { custom: "data" },
        body: { custom: "body" },
      });

  if (shouldThrow) {
    throw error;
  }

  return error;
};
