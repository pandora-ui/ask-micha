import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

export type RunMode = "pilot" | "manual";
export type RunJobStatus = "running" | "completed" | "failed";

export interface StreamItem {
  rank: number;
  title: string;
  url: string;
  score: number;
  source?: string;
}

export interface RunJob {
  id: string;
  mode: RunMode;
  status: RunJobStatus;
  started_at: string;
  ended_at: string | null;
  run_key: string | null;
  top_items: number | null;
  logs: string[];
  error: string | null;
  stream_items: StreamItem[];
}

const MAX_LOGS = 1200;
const DEFAULT_MAX_RUNTIME_MS = 10 * 60 * 1000;

type RunJobStore = {
  jobs: Map<string, RunJob>;
};

const getStore = (): RunJobStore => {
  const g = globalThis as unknown as { __runJobStore?: RunJobStore };
  if (!g.__runJobStore) {
    g.__runJobStore = { jobs: new Map<string, RunJob>() };
  }
  return g.__runJobStore;
};

const appendLog = (job: RunJob, line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  job.logs.push(trimmed);
  if (job.logs.length > MAX_LOGS) {
    job.logs.splice(0, job.logs.length - MAX_LOGS);
  }
};

const parseCompletion = (line: string): { run_key: string; top_items: number } | null => {
  const match = line.match(/Run complete:\s*([^,]+),\s*top items:\s*(\d+)/i);
  if (!match) return null;
  return {
    run_key: match[1]?.trim() ?? "",
    top_items: Number(match[2] ?? 0)
  };
};

export const startRunJob = (mode: RunMode, verbose = true, maxItems = 20, goalName?: string): RunJob => {
  const store = getStore();
  const id = randomUUID();
  const job: RunJob = {
    id,
    mode,
    status: "running",
    started_at: new Date().toISOString(),
    ended_at: null,
    run_key: null,
    top_items: null,
    logs: [],
    error: null,
    stream_items: []
  };

  store.jobs.set(id, job);

  const repoRoot = resolve(process.cwd(), "../..");
  const scriptArgs: string[] = ["--max-items", String(maxItems)];
  if (verbose) scriptArgs.unshift("--verbose");
  if (goalName) scriptArgs.push("--goal-name", goalName);
  const args = ["--filter", "@mvp/worker", mode, "--", ...scriptArgs];

  const child = spawn("pnpm", args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const maxRuntimeMs = Number(process.env.RUN_JOB_TIMEOUT_MS ?? DEFAULT_MAX_RUNTIME_MS);
  const timeoutMs = Number.isFinite(maxRuntimeMs) && maxRuntimeMs > 0 ? maxRuntimeMs : DEFAULT_MAX_RUNTIME_MS;
  let finished = false;
  let completionDetected = false;
  let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

  const runtimeTimer = setTimeout(() => {
    if (finished || completionDetected) return;
    job.status = "failed";
    job.ended_at = new Date().toISOString();
    job.error = `worker timed out after ${Math.round(timeoutMs / 1000)}s`;
    appendLog(job, `[dashboard] ${job.error}`);
    child.kill("SIGTERM");

    forceKillTimer = setTimeout(() => {
      if (finished) return;
      child.kill("SIGKILL");
    }, 5000);
    forceKillTimer.unref();
  }, timeoutMs);
  runtimeTimer.unref();

  const onData = (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split(/\r?\n/);
    for (const line of lines) {
      appendLog(job, line);
      // Parse real-time ranked items for live dashboard preview
      const streamMarker = "[STREAM_ITEM] ";
      const streamIdx = line.indexOf(streamMarker);
      if (streamIdx !== -1) {
        try {
          const parsed = JSON.parse(line.slice(streamIdx + streamMarker.length)) as StreamItem;
          if (typeof parsed.rank === "number" && parsed.title && parsed.url) {
            const existing = job.stream_items.findIndex((x) => x.rank === parsed.rank);
            if (existing >= 0) job.stream_items[existing] = parsed;
            else job.stream_items.push(parsed);
          }
        } catch { /* ignore malformed lines */ }
      }
      // Detect "Run complete:" in output and immediately mark job done.
      // Fixes: Node.js worker process keeps running after completion due to
      // open HTTP keep-alive handles (Directus/OpenAI clients), causing the
      // child "close" event to never fire. cli.ts now calls process.exit(0)
      // as the primary fix; this is a belt-and-suspenders fallback.
      if (!completionDetected) {
        const completion = parseCompletion(line);
        if (completion) {
          completionDetected = true;
          job.run_key = completion.run_key;
          job.top_items = completion.top_items;
          job.status = "completed";
          job.ended_at = new Date().toISOString();
          appendLog(job, "[dashboard] completion detected in output — run finished");
          clearTimeout(runtimeTimer);
        }
      }
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("close", (code) => {
    finished = true;
    clearTimeout(runtimeTimer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
    if (completionDetected) {
      // Already marked completed via log detection — just record exit
      appendLog(job, `[dashboard] worker process exited (code: ${code ?? "?"})`);
    } else if (job.status === "failed") {
      appendLog(job, "[dashboard] run process exited after failure");
    } else if (code === 0) {
      job.status = "completed";
      job.ended_at = new Date().toISOString();
      appendLog(job, "[dashboard] run process finished successfully");
    } else {
      job.status = "failed";
      job.ended_at = new Date().toISOString();
      job.error = `worker exited with code ${code ?? -1}`;
      appendLog(job, `[dashboard] ${job.error}`);
    }
  });

  child.on("error", (error) => {
    finished = true;
    clearTimeout(runtimeTimer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
    job.status = "failed";
    job.ended_at = new Date().toISOString();
    job.error = error.message;
    appendLog(job, `[dashboard] spawn error: ${error.message}`);
  });

  return job;
};

export const getRunJob = (id: string): RunJob | null => {
  const store = getStore();
  return store.jobs.get(id) ?? null;
};

export const listRecentJobs = (): RunJob[] => {
  const store = getStore();
  return Array.from(store.jobs.values()).sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 20);
};
