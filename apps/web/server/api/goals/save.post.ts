import { validateGoalSpec } from "@mvp/schemas";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { goalSpec: unknown };
  const goalSpec = validateGoalSpec(body.goalSpec);
  const directus = getDirectusClient();

  const latest = await directus.listLatest<{ version: number }>("ai_goal_specs", "goal_json");
  const version = (latest?.version ?? 0) + 1;

  const next = {
    ...goalSpec,
    version,
    created_at: new Date().toISOString()
  };

  await directus.createVersionedRecord("ai_goal_specs", {
    name: next.name,
    version: next.version,
    json: next
  });

  return { goalSpec: next };
});
