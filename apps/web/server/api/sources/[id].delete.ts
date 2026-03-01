import { validateSourcePolicy } from "@mvp/schemas";
import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const sourceId = getRouterParam(event, "id");
  if (!sourceId) throw createError({ statusCode: 400, message: "id required" });

  const directus = getDirectusClient();
  const result = await directus.getLatestSourcePolicyWithVersion();
  const current = result?.policy ?? defaultSourcePolicy();

  const idx = current.sources.findIndex((s) => s.id === sourceId);
  if (idx === -1) throw createError({ statusCode: 404, message: `Source "${sourceId}" not found` });

  const sources = current.sources.filter((s) => s.id !== sourceId);

  if (sources.length < 2) {
    throw createError({ statusCode: 400, message: "At least 2 sources must remain" });
  }

  const nextVersion = (result?.version ?? current.version) + 1;
  const nextPolicy = validateSourcePolicy({
    ...current,
    version: nextVersion,
    sources,
    created_at: new Date().toISOString()
  });

  await directus.createVersionedRecord("ai_source_policies", {
    name: nextPolicy.name,
    version: nextPolicy.version,
    json: nextPolicy
  });

  return { ok: true };
});
