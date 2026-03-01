import { getDirectusClient } from "../../utils/directus";

interface ScheduleConfig {
  id: number | null;
  enabled: boolean;
  frequency: "daily" | "weekly";
  day: number;
  time: string;
  timezone: string;
  cron_raw: string;
}

function parseCron(cron: string): Pick<ScheduleConfig, "frequency" | "day" | "time"> {
  // Supported formats:
  //   "MM HH * * *"   → daily
  //   "MM HH * * DOW" → weekly
  const parts = cron.trim().split(/\s+/);
  const mm = parseInt(parts[0] ?? "0", 10);
  const hh = parseInt(parts[1] ?? "9", 10);
  const dow = parts[4] ?? "*";

  const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const frequency = dow === "*" ? "daily" : "weekly";
  const day = frequency === "weekly" ? parseInt(dow, 10) : 1;

  return { frequency, day, time };
}

export default defineEventHandler(async (): Promise<ScheduleConfig> => {
  try {
    const directus = getDirectusClient();
    const project = await directus.getProject();

    if (!project) {
      return {
        id: null,
        enabled: false,
        frequency: "weekly",
        day: 1,
        time: "09:00",
        timezone: "Europe/Berlin",
        cron_raw: "0 9 * * 1"
      };
    }

    const cron = project.schedule_cron ?? "0 9 * * 1";
    const parsed = parseCron(cron);

    return {
      id: project.id,
      enabled: project.enabled ?? false,
      frequency: parsed.frequency,
      day: parsed.day,
      time: parsed.time,
      timezone: project.timezone ?? "Europe/Berlin",
      cron_raw: cron
    };
  } catch {
    return {
      id: null,
      enabled: false,
      frequency: "weekly",
      day: 1,
      time: "09:00",
      timezone: "Europe/Berlin",
      cron_raw: "0 9 * * 1"
    };
  }
});
