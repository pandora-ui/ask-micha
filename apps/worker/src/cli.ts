import cron from "node-cron";
import { DirectusClient } from "@mvp/shared";
import { env } from "./env";
import { runPipeline } from "./core/pipeline";

const client = new DirectusClient({
  baseUrl: env.directusUrl,
  adminToken: env.directusAdminToken
});

const parseCliArgs = () => {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const modeArg = args.find((arg) => arg === "pilot" || arg === "manual" || arg === "schedule");
  const mode = (modeArg ?? "schedule") as "pilot" | "manual" | "schedule";
  const verbose = args.includes("--verbose") || args.includes("-v");
  const maxItemsIdx = args.indexOf("--max-items");
  const maxItems = maxItemsIdx !== -1
    ? Math.max(1, Math.min(50, parseInt(args[maxItemsIdx + 1] ?? "20", 10)))
    : 20;
  const goalNameIdx = args.indexOf("--goal-name");
  const goalName = goalNameIdx !== -1 ? (args[goalNameIdx + 1] ?? undefined) : undefined;
  return { mode, verbose, maxItems, goalName };
};

const runOnce = async (mode: "pilot" | "manual" | "scheduled"): Promise<void> => {
  const { verbose, maxItems, goalName } = parseCliArgs();
  let step = 0;
  const progress = (message: string, level: "info" | "debug" = "info") => {
    if (level === "debug" && !verbose) {
      return;
    }
    step += 1;
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${mode}] [${level.toUpperCase()}] step ${step}: ${message}`);
  };

  progress(`Starting run${verbose ? " (verbose)" : ""}, max items: ${maxItems}${goalName ? `, goal: ${goalName}` : ""}`);
  const result = await runPipeline({
    mode,
    directus: client,
    openAiApiKey: env.openAiApiKey,
    openAiModel: env.openAiModel,
    verbose,
    maxItems,
    goalName,
    onProgress: progress
  });
  console.log(`Run complete: ${result.runKey}, top items: ${result.topCount}`);
};

const { mode: command } = parseCliArgs();

if (command === "pilot") {
  runOnce("pilot")
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else if (command === "manual") {
  runOnce("manual")
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  // Load schedule config from Directus (ai_projects), fall back to Monday 09:00 Berlin
  client.getProject().then((project) => {
    const cronExpr = project?.schedule_cron ?? "0 9 * * 1";
    const timezone = project?.timezone ?? "Europe/Berlin";
    const enabled = project?.enabled ?? true;

    if (!enabled) {
      console.log("Worker scheduler: auto-search disabled in project config. Exiting.");
      process.exit(0);
    }

    console.log(`Worker scheduler active: "${cronExpr}" (${timezone})`);
    cron.schedule(
      cronExpr,
      () => {
        runOnce("scheduled").catch((error) => {
          console.error("Scheduled run failed", error);
        });
      },
      { timezone }
    );
  }).catch((err) => {
    const fallbackCron = "0 9 * * 1";
    console.warn("Could not load project schedule from Directus, using fallback:", err.message);
    console.log(`Worker scheduler active: "${fallbackCron}" (Europe/Berlin) [fallback]`);
    cron.schedule(
      fallbackCron,
      () => {
        runOnce("scheduled").catch((error) => {
          console.error("Scheduled run failed", error);
        });
      },
      { timezone: "Europe/Berlin" }
    );
  });
}
