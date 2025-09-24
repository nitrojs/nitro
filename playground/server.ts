declare let __DEMO_CLIENT_ENTRY__: string;

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/app") {
      return new Response(
        `\
<div>Server Time: ${new Date().toISOString()}</div>
<div id="client-app"></div>
<script type="module" src=${JSON.stringify(__DEMO_CLIENT_ENTRY__)}></script>
`,
        {
          headers: {
            "content-type": "text/html;charset=utf-8",
          },
        }
      );
    }
    return new Response(`Hello world! (${req.url})`);
  },
};
