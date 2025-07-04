/// <reference types="vite/client" />
import { defineHandler, html } from "h3";

// @ts-ignore
import viteLogo from "../assets/vite.svg";
// const nitroLogo = "https://nitro.build/icon.svg";

// @ts-ignore
import nitroLogo from "../assets/nitro.svg";
// const viteLogo = "https://vitejs.dev/logo.svg";
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
    </div>
  </body>
</html>
  `
  );
});
