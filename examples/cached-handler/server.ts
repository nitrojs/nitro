import { html } from "nitro/h3";
import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return html`
      Response generated at ${new Date().toISOString()} (took 500ms)
      <br />(<a href="?skipCache=true">skip cache</a>)
    `;
  },
  { shouldBypassCache: ({ req }) => req.url.includes("skipCache=true") }
);
