/// <reference types="vite/client" />

import viteLogo from "../assets/vite.svg";
import nitroLogo from "../assets/nitro.svg";
import vueLogo from "../assets/vue.svg";
import honoLogo from "../assets/hono.svg";
import h3Logo from "../assets/h3.svg";
import reactLogo from "../assets/react.svg";
import nodeLogo from "../assets/node.svg";

const services = {
  vue: { logo: vueLogo, path: "/vue" },
  hono: { logo: honoLogo, path: "/hono" },
  h3: { logo: h3Logo, path: "/h3" },
  react: { logo: reactLogo, path: "/react" },
  node: { logo: nodeLogo, path: "/node" },
};

export const fetch = async (_req) => {
  const html = /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + Nitro!</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100vh;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      }
      .logo-container {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 150px;
        text-align: center;
        color: #666;
      }
      .logo-container img {
        width: 200px;
      }
      .services {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
      }
      .services a {
        margin: 20px 10px;
        text-decoration: none;
      }
      img {
        width: 75px;
        transition: transform 0.3s ease;
      }
      img:hover {
        transform: scale(1.1);
      }
    </style>

    ${import.meta.env?.DEV ? '<script type="module" src="/@vite/client"></script>' : ""}
  </head>
  <body>
    <div id="app">
      <div class="logo-container">
        <a href="https://vitejs.dev" target="_blank">
          <img src="${viteLogo}" alt="Vite logo" />
        </a>
        <div id="plus">＋</div>
        <a href="https://nitro.build" target="_blank">
          <img src="${nitroLogo}" alt="Nitro logo" />
        </a>
      </div>
      <h1>Vite 🤜🤛 Nitro</h1>
      <div class="services">
          ${Object.entries(services)
            .sort(() => Math.random() - 0.5)
            .map(
              ([name, { logo, path }]) => `
            <a href="${path}">
              <img src="${logo}" alt="${name} logo" />
            </a>
          `
            )
            .join("\n")}
      </div>
      <div class="footer">
        <a href="https://github.com/nitrojs/nitro/pull/3440" target="_blank">
        [ Learn More ]
       </a>
      </div>
    </div>
  </body>
</html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
