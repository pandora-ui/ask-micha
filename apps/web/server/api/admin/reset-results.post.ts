import { getDirectusClient } from "../../utils/directus";

const TARGET_COLLECTIONS = [
  "ai_runs",
  "ai_run_items",
  "ai_feedback",
  "ai_discovery_answers",
  "ai_sources",
  "ai_goal_specs"
] as const;

const CONFIRM_TEXT = "RESET RESULTS";

type ItemRecord = { id: string | number };

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { confirm?: string };

  if ((body.confirm ?? "").trim() !== CONFIRM_TEXT) {
    throw createError({
      statusCode: 400,
      message: `Confirmation text invalid. Use exactly: ${CONFIRM_TEXT}`
    });
  }

  const directus = getDirectusClient();
  const deleted: Record<string, number> = {};

  for (const collection of TARGET_COLLECTIONS) {
    let totalDeleted = 0;

    while (true) {
      const page = await directus.request<{ data: ItemRecord[] }>(
        `/items/${collection}?fields=id&limit=200`
      );
      const ids = page.data.map((item) => item.id).filter((id) => id !== null && id !== undefined);

      if (ids.length === 0) break;

      await directus.request(`/items/${collection}`, {
        method: "DELETE",
        body: JSON.stringify({ keys: ids })
      });

      totalDeleted += ids.length;
    }

    deleted[collection] = totalDeleted;
  }

  return {
    ok: true,
    deleted,
    note: "Result collections and saved goals were reset."
  };
});
