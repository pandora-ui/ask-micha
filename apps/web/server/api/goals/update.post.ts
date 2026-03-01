import { validateGoalSpec, type GoalSpec } from "@mvp/schemas";
import { defaultGoalSpec } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as Partial<GoalSpec>;
  const directus = getDirectusClient();

  const latest = await directus.listLatest<GoalSpec>("ai_goal_specs", "goal_json");
  const current = latest ?? defaultGoalSpec();
  const version = (current.version ?? 0) + 1;

  const next = validateGoalSpec({
    ...current,
    ...body,
    version,
    created_at: new Date().toISOString()
  });

  await directus.createVersionedRecord("ai_goal_specs", {
    name: next.name,
    version: next.version,
    json: next
  });

  return { goalSpec: next };
});
