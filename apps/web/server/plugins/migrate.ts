import { DirectusClient } from "@mvp/shared";

export default defineNitroPlugin(async () => {
  try {
    const config = useRuntimeConfig();
    if (!config.directusUrl || !config.directusAdminToken) return;

    const directus = new DirectusClient({
      baseUrl: config.directusUrl,
      adminToken: config.directusAdminToken
    });

    await directus.ensureSchema();
    console.log("[migrate] schema ensured");
  } catch (err) {
    console.warn("[migrate] schema migration failed:", err);
  }
});
