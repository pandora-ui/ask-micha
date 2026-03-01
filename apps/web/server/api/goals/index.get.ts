import { validateGoalSpec, type GoalSpec } from "@mvp/schemas";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async () => {
  const directus = getDirectusClient();

  const response = await directus.request<{
    data: Array<{ name: string; version: number; goal_json: unknown }>;
  }>("/items/ai_goal_specs?limit=200&sort=-version&fields=name,version,goal_json");

  // Group by name, take first (= latest version) per name
  const seen = new Set<string>();
  const goals: Array<{ name: string; version: number; goalSpec: GoalSpec }> = [];

  for (const row of response.data) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    try {
      goals.push({
        name: row.name,
        version: row.version,
        goalSpec: validateGoalSpec(row.goal_json)
      });
    } catch {
      // Skip invalid records
    }
  }

  return { goals };
});
