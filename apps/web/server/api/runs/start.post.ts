import { startRunJob } from "../../utils/run-jobs";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { mode?: "pilot" | "manual"; verbose?: boolean; maxItems?: number; goalName?: string };
  const mode = body.mode ?? "manual";

  if (mode !== "pilot" && mode !== "manual") {
    throw createError({ statusCode: 400, message: "mode must be 'pilot' or 'manual'" });
  }

  const maxItems = typeof body.maxItems === "number" && body.maxItems > 0
    ? Math.min(50, Math.max(1, body.maxItems))
    : 20;

  const goalName = typeof body.goalName === "string" && body.goalName ? body.goalName : undefined;
  const job = startRunJob(mode, body.verbose ?? true, maxItems, goalName);

  return {
    id: job.id,
    mode: job.mode,
    status: job.status,
    started_at: job.started_at
  };
});
