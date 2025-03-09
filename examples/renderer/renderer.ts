import { defineRenderHandler } from "nitro/runtime";

export default defineRenderHandler((_event) => {
  return {
    body: /* html */ `<!DOCTYPE html>
    <html>
      <head>
        <title>Rendered Page</title>
        </head>
        <body>
            <h1>Rendered by Nitro!</h1>
        </body>
    </html>`,
  };
});
