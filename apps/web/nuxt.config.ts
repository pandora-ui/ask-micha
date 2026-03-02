import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  modules: ["@nuxtjs/tailwindcss"],
  runtimeConfig: {
    directusUrl: process.env.DIRECTUS_URL,
    directusAdminToken: process.env.DIRECTUS_ADMIN_TOKEN,
    openAiApiKey: process.env.OPENAI_API_KEY,
    public: {},
  },
});
