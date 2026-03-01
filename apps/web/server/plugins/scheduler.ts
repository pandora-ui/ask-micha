import cron from "node-cron";
import { startRunJob } from "../utils/run-jobs";

type ScheduledTask = ReturnType<typeof cron.schedule>;

declare global {
  // eslint-disable-next-line no-var
  var __schedulerTask: ScheduledTask | undefined;
  // eslint-disable-next-line no-var
  var __updateScheduler: ((cfg: { enabled: boolean; cron_expression: string; timezone: string }) => void) | undefined;
}

function applySchedule(cfg: { enabled: boolean; cron_expression: string; timezone: string }) {
  if (globalThis.__schedulerTask) {
    globalThis.__schedulerTask.stop();
    globalThis.__schedulerTask = undefined;
  }

  if (!cfg.enabled) {
    console.log("[scheduler] auto-search disabled");
    return;
  }

  if (!cron.validate(cfg.cron_expression)) {
    console.warn("[scheduler] invalid cron expression:", cfg.cron_expression);
    return;
  }

  globalThis.__schedulerTask = cron.schedule(
    cfg.cron_expression,
    () => {
      console.log("[scheduler] auto-search triggered:", new Date().toISOString());
      startRunJob("manual", true, 20);
    },
    { timezone: cfg.timezone }
  );

  console.log(`[scheduler] auto-search active: "${cfg.cron_expression}" (${cfg.timezone})`);
}

export default defineNitroPlugin(async () => {
  // Make the updater available to the schedule POST route
  globalThis.__updateScheduler = applySchedule;

  // Load schedule from Directus on server startup
  try {
    const config = useRuntimeConfig();
    if (!config.directusUrl || !config.directusAdminToken) return;

    const res = await fetch(`${config.directusUrl}/items/ai_projects?limit=1`, {
      headers: { Authorization: `Bearer ${config.directusAdminToken}` }
    });

    if (!res.ok) return;

    const data = await res.json() as { data?: Array<{ enabled: boolean; schedule_cron: string; timezone: string }> };
    const project = data?.data?.[0];

    if (project) {
      applySchedule({
        enabled: project.enabled ?? false,
        cron_expression: project.schedule_cron ?? "0 9 * * 1",
        timezone: project.timezone ?? "Europe/Berlin"
      });
    }
  } catch (err) {
    console.warn("[scheduler] could not load schedule from Directus:", err);
  }
});
