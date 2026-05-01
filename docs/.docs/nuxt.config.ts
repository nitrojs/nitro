import { defineNuxtConfig } from "nuxt/config"

export default defineNuxtConfig({
  modules: ['motion-v/nuxt'],
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Geist', weights: [400, 600, 700], global: true },
      { name: 'Geist Mono', weights: [400, 600], global: true },
      { name: "Geist Pixels", src: "/assets/fonts/GeistPixel-Square.woff2", weight: 500, global: true },
    ],
  },
})
