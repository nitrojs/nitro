export default {
  async fetch(req: Request): Promise<Response> {
    const { message } = await fetch("/api/hello", { viteEnv: "nitro" }).then(
      (r) => r.json()
    );
    return new Response(
      /* html */ `<!DOCTYPE html>
      <html>
      <head>
        <title>Vite Nitro Playground</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        Server response: <strong>${message}</strong>
        <br>
        Client response: <strong id="client-response"></strong>
        <script type="module">
          await fetch("/api/hello").then((r) => r.json()).then((data) => {
            document.getElementById("client-response").textContent = data.message;
          });
        </script>
      `,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  },
};
