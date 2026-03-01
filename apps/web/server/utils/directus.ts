import { DirectusClient } from "@mvp/shared";

export const getDirectusClient = () => {
  const config = useRuntimeConfig();

  if (!config.directusUrl || !config.directusAdminToken) {
    throw createError({ statusCode: 500, message: "Missing Directus runtime config" });
  }

  return new DirectusClient({
    baseUrl: config.directusUrl,
    adminToken: config.directusAdminToken
  });
};
