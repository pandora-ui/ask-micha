import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const name = decodeURIComponent(getRouterParam(event, "name") ?? "");
  if (!name) throw createError({ statusCode: 400, message: "name required" });

  const directus = getDirectusClient();

  // Check how many distinct goals exist — refuse to delete the last one
  const allGoals = await directus.request<{ data: Array<{ name: string }> }>(
    "/items/ai_goal_specs?limit=200&fields=name"
  );
  const distinctNames = new Set(allGoals.data.map((r) => r.name));
  if (distinctNames.size <= 1) {
    throw createError({ statusCode: 400, message: "Cannot delete the last goal" });
  }

  // Fetch all record IDs for this goal name
  const records = await directus.request<{ data: Array<{ id: number }> }>(
    `/items/ai_goal_specs?filter[name][_eq]=${encodeURIComponent(name)}&fields=id&limit=200`
  );

  if (records.data.length === 0) {
    throw createError({ statusCode: 404, message: `Goal "${name}" not found` });
  }

  for (const record of records.data) {
    await directus.request(`/items/ai_goal_specs/${record.id}`, { method: "DELETE" });
  }

  return { ok: true, deleted: records.data.length };
});
