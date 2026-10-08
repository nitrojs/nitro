export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    // Links rendered by an app with `baseURL` include the base
    const links = ["/base/", "/base/about", "/base/admin", "/base/base/about"]
      .map((href) => `<a href="${href}">${href}</a>`)
      .join("");
    return new Response(`<h1>${pathname}</h1>${links}`, {
      headers: { "content-type": "text/html" },
    });
  },
};
