import { validateGoalSpec } from "@mvp/schemas";
import { defaultGoalSpec } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name as string | undefined;

  const directus = getDirectusClient();

  if (name) {
    const response = await directus.request<{
      data: Array<{ goal_json: unknown }>;
    }>(
      `/items/ai_goal_specs?filter[name][_eq]=${encodeURIComponent(name)}&limit=1&sort=-version&fields=goal_json`
    );
    const row = response.data[0];
    return {
      goalSpec: validateGoalSpec(row?.goal_json ?? defaultGoalSpec())
    };
  }

  const latest = await directus.listLatest("ai_goal_specs", "goal_json");
  return {
    goalSpec: validateGoalSpec(latest ?? defaultGoalSpec())
  };
});
