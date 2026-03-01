import { validateSourcePolicy } from "@mvp/schemas";
import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const sourceId = getRouterParam(event, "id");
  if (!sourceId) throw createError({ statusCode: 400, message: "id required" });

  const body = await readBody(event) as {
    enabled?: boolean;
    weight?: number;
  };

  const directus = getDirectusClient();
  const result = await directus.getLatestSourcePolicyWithVersion();
  const current = result?.policy ?? defaultSourcePolicy();

  const idx = current.sources.findIndex((s) => s.id === sourceId);
  if (idx === -1) throw createError({ statusCode: 404, message: `Source "${sourceId}" not found` });

  const sources = current.sources.map((s, i) => {
    if (i !== idx) return s;
    return {
      ...s,
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.weight !== undefined ? { weight: Math.min(1, Math.max(0, body.weight)) } : {})
    };
  });

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

  return { source: sources[idx] };
});
