import { getDirectusClient } from "../../utils/directus";

interface ScheduleBody {
  enabled: boolean;
  frequency: "daily" | "weekly";
  day?: number;
  time: string;
  timezone?: string;
}

function buildCron(frequency: "daily" | "weekly", day: number, time: string): string {
  const [hhStr, mmStr] = time.split(":");
  const hh = parseInt(hhStr ?? "9", 10);
  const mm = parseInt(mmStr ?? "0", 10);
  if (frequency === "daily") return `${mm} ${hh} * * *`;
  return `${mm} ${hh} * * ${day}`;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as ScheduleBody;

  if (typeof body.enabled !== "boolean") {
    throw createError({ statusCode: 400, message: "enabled must be boolean" });
  }
  if (!["daily", "weekly"].includes(body.frequency)) {
    throw createError({ statusCode: 400, message: "frequency must be daily or weekly" });
  }
  if (!body.time || !/^\d{1,2}:\d{2}$/.test(body.time)) {
    throw createError({ statusCode: 400, message: "time must be HH:MM" });
  }

  const day = body.frequency === "weekly" ? (body.day ?? 1) : 1;
  const timezone = body.timezone ?? "Europe/Berlin";
  const cron = buildCron(body.frequency, day, body.time);

  const directus = getDirectusClient();
  const project = await directus.getProject();

  if (project?.id) {
    await directus.updateProject(project.id, {
      schedule_cron: cron,
      enabled: body.enabled,
      timezone
    });
  }

  // Update the in-memory scheduler if it exists
  const updater = (globalThis as Record<string, unknown>).__updateScheduler as
    | ((cfg: { enabled: boolean; cron_expression: string; timezone: string }) => void)
    | undefined;
  updater?.({ enabled: body.enabled, cron_expression: cron, timezone });

  return { ok: true, cron, enabled: body.enabled };
});
