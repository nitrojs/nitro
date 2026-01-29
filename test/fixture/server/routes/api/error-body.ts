import { HTTPError } from "nitro/h3";

export default () => {
  throw new HTTPError({
    status: 500,
    message: "Custom error message",
    data: {
      instance: "local",
    },
    body: { code: "urn:nitro:missing-error-code" },
  });
};
