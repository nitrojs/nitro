/// <reference types="vite/client" />
import { defineHandler, html } from "h3";

import viteLogo from "../assets/vite.svg";
import nitroLogo from "../assets/nitro.svg";
import vueLogo from "../assets/vue.svg";
import honoLogo from "../assets/hono.svg";
import h3Logo from "../assets/h3.svg";

const services = {
  vue: { logo: vueLogo, path: "/vue" },
  hono: { logo: honoLogo, path: "/hono" },
  h3: { logo: h3Logo, path: "/h3" },
  // api: { logo: viteLogo, path: "/api" },
};

export default defineHandler(async (event) => {
  return html(
    event,
    /* html */ `<!doctype html>
<html lang="en">
  <head>
    ${import.meta.hot ? '<script type="module" src="/@vite/client"></script>' : ""}
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
        user-select: none;
        color: #666;
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
      .services img {
        width: 75px;
        transition: transform 0.3s ease;
      }
      .services img:hover {
        transform: scale(1.1);
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="logo-container">
        <img src="${viteLogo}" alt="Vite logo" width="200" />
        <div id="plus">＋</div>
        <img src="${nitroLogo}" alt="Nitro logo" width="200" />
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
  `
  );
});
