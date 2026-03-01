<script setup lang="ts">
import type { GoalSpec } from "@mvp/schemas";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Job = {
  id: string;
  mode: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  ended_at: string | null;
  run_key: string | null;
  top_items: number | null;
  logs: string[];
  error: string | null;
  stream_items: Array<{ rank: number; title: string; url: string; score: number; source?: string }>;
};

type HighlightItem = {
  rank: number;
  title: string;
  url: string;
  score: number;
  impact_tag: string;
  why_it_matters: string;
  risks: string;
  source: string;
};

type RunHighlights = {
  has_data: boolean;
  run_key?: string;
  mode?: string;
  status?: string;
  generated_at?: string | null;
  headline: string;
  key_message: string;
  executive_summary: string;
  critical_updates: string[];
  top_highlights: HighlightItem[];
  other_highlights: HighlightItem[];
  warnings?: string[];
};

type ScheduleData = {
  id: number | null;
  enabled: boolean;
  frequency: "daily" | "weekly";
  day: number;
  time: string;
  timezone: string;
  cron_raw: string;
};

type GoalEntry = {
  name: string;
  version: number;
  goalSpec: GoalSpec;
};

type RunHistoryHighlight = {
  headline: string;
  top_items: Array<{ rank: number; title: string; url: string; score: number; source: string }>;
  top_count: number;
  total_candidates: number | null;
};

// ─── Goals Management ──────────────────────────────────────────────────────────
async function setActiveGoal(name: string) {
  activeGoalName.value = name;
  localStorage.setItem("activeGoalName", name);
  await Promise.all([refreshGoal(), refreshHighlights()]);
}

async function deleteGoal(name: string) {
  if (!confirm(`Delete goal "${name}"? This cannot be undone.`)) return;
  try {
    await $fetch(`/api/goals/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (activeGoalName.value === name) {
      activeGoalName.value = null;
      localStorage.removeItem("activeGoalName");
    }
    await Promise.all([refreshGoals(), refreshGoal(), refreshHighlights()]);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Delete failed");
  }
}

// ─── Run History Expansion ─────────────────────────────────────────────────────
const expandedRuns = ref<Set<string>>(new Set());
const runHighlights = reactive<Record<string, RunHistoryHighlight | null>>({});
const loadingRuns = ref<Set<string>>(new Set());

async function toggleRun(runKey: string) {
  const next = new Set(expandedRuns.value);
  if (next.has(runKey)) {
    next.delete(runKey);
  } else {
    next.add(runKey);
    if (!(runKey in runHighlights)) {
      loadingRuns.value = new Set([...loadingRuns.value, runKey]);
      try {
        const data = await $fetch<RunHistoryHighlight>(`/api/runs/${encodeURIComponent(runKey)}/highlights`);
        runHighlights[runKey] = data;
      } catch {
        runHighlights[runKey] = null;
      } finally {
        const lr = new Set(loadingRuns.value);
        lr.delete(runKey);
        loadingRuns.value = lr;
      }
    }
  }
  expandedRuns.value = next;
}

// ─── Dark Mode ─────────────────────────────────────────────────────────────────
const isDark = ref(false);
onMounted(() => {
  const stored = localStorage.getItem("color-mode");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  isDark.value = stored !== null ? stored === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", isDark.value);

  // Active goal from URL param (after wizard redirect) or localStorage
  const route = useRoute();
  const goalParam = route.query.goal as string | undefined;
  if (goalParam) {
    activeGoalName.value = goalParam;
    localStorage.setItem("activeGoalName", goalParam);
  } else {
    activeGoalName.value = localStorage.getItem("activeGoalName");
  }
});
const toggleDark = () => {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("color-mode", isDark.value ? "dark" : "light");
};

// ─── Static class maps ─────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  ok:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800",
  bad:  "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800",
  idle: "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
};
const STATUS_DOT: Record<string, string> = {
  ok:   "bg-emerald-500",
  warn: "bg-amber-400 animate-pulse",
  bad:  "bg-red-500",
  idle: "bg-slate-400"
};
const IMPACT_TAG: Record<string, string> = {
  "model":        "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  "market":       "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  "regulation":   "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  "open source":  "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  "execution":    "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  "default":      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
};

const statusTone = (s?: string | null) =>
  s === "completed" ? "ok" : s === "running" ? "warn" : s === "failed" ? "bad" : "idle";
const badgeClass = (s?: string | null) => STATUS_BADGE[statusTone(s)] ?? STATUS_BADGE.idle;
const dotClass   = (s?: string | null) => STATUS_DOT[statusTone(s)]   ?? STATUS_DOT.idle;
const tagClass = (tag: string) => {
  const t = (tag ?? "").toLowerCase();
  for (const [k, v] of Object.entries(IMPACT_TAG))
    if (k !== "default" && t.includes(k)) return v;
  return IMPACT_TAG.default;
};
const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const computeImpactTag = (title: string): string => {
  const t = title.toLowerCase();
  if (/model|llm|inference|benchmark|agent|copilot|multimodal/.test(t)) return "Model Shift";
  if (/fund|raise|valuation|acqui|merger|earnings|revenue/.test(t))      return "Market Move";
  if (/regulation|policy|compliance|law|eu|act|court|antitrust/.test(t)) return "Regulation";
  if (/deploy|rollout|launch|release|ship|introduc|ga|preview/.test(t))  return "Execution";
  if (/opensource|open source|github|repository|sdk|framework/.test(t))  return "Open Source";
  return "Signal";
};

// ─── Active Goal (localStorage-based selection) ────────────────────────────────
const activeGoalName = ref<string | null>(null);

// ─── Data Fetching ─────────────────────────────────────────────────────────────
const { data: goalsData, refresh: refreshGoals } = await useFetch<{ goals: GoalEntry[] }>("/api/goals", {
  default: () => ({ goals: [] })
});

const { data: goalData, refresh: refreshGoal } = await useFetch<{ goalSpec: GoalSpec }>(
  () => `/api/goals/latest${activeGoalName.value ? "?name=" + encodeURIComponent(activeGoalName.value) : ""}`,
  { key: "goalSpec", default: () => ({ goalSpec: null as unknown as GoalSpec }) }
);
const { data: scheduleData, refresh: refreshSchedule } = await useFetch<ScheduleData>("/api/schedule", {
  default: () => ({ id: null, enabled: false, frequency: "weekly" as const, day: 1, time: "09:00", timezone: "Europe/Berlin", cron_raw: "0 9 * * 1" })
});
const { data: historyData, refresh: refreshHistory, pending: historyPending } = await useFetch<{
  runs: Array<{ run_key: string; mode: string; status: string; generated_at: string | null; top_count: number | null; total_candidates: number | null }>;
}>("/api/runs/history", { default: () => ({ runs: [] }) });
const { data: highlightsData, refresh: refreshHighlights } = await useFetch<RunHighlights>(
  () => `/api/runs/highlights${activeGoalName.value ? "?goal=" + encodeURIComponent(activeGoalName.value) : ""}`,
  { key: "highlights", default: () => ({ has_data: false, headline: "", key_message: "", executive_summary: "", critical_updates: [], top_highlights: [], other_highlights: [] }) }
);

// ─── Goal Editor State ─────────────────────────────────────────────────────────
const editGoalOpen   = ref(false);
const isSavingGoal   = ref(false);
const goalSaveMsg    = ref("");
const goalSaveErr    = ref("");
const focusInput     = ref("");
const excludeInput   = ref("");
const keywordInput   = ref("");

const editForm = reactive<Partial<GoalSpec>>({
  name: "",
  focus_topics: [],
  excluded_topics: [],
  must_include_keywords: [],
  lookback_days: 7,
  max_items: 20
});

function openGoalEditor() {
  const spec = goalData.value?.goalSpec;
  if (spec) {
    editForm.name                 = spec.name;
    editForm.focus_topics         = [...(spec.focus_topics ?? [])];
    editForm.excluded_topics      = [...(spec.excluded_topics ?? [])];
    editForm.must_include_keywords = [...(spec.must_include_keywords ?? [])];
    editForm.lookback_days        = spec.lookback_days;
    editForm.max_items            = spec.max_items;
  }
  goalSaveMsg.value = "";
  goalSaveErr.value = "";
  focusInput.value   = "";
  excludeInput.value = "";
  keywordInput.value = "";
  editGoalOpen.value = true;
}

// Per-field tag input helpers (avoids ref-passing anti-pattern in templates)
function addFocusTopic() {
  const val = focusInput.value.replace(/,/g, "").trim().toLowerCase();
  if (val && editForm.focus_topics && !editForm.focus_topics.includes(val)) editForm.focus_topics.push(val);
  focusInput.value = "";
}
function onFocusKeydown(e: KeyboardEvent) {
  if (e.key === "," || e.key === "Enter") { e.preventDefault(); addFocusTopic(); }
  if (e.key === "Backspace" && focusInput.value === "") editForm.focus_topics?.pop();
}

function addExcludeTopic() {
  const val = excludeInput.value.replace(/,/g, "").trim().toLowerCase();
  if (val && editForm.excluded_topics && !editForm.excluded_topics.includes(val)) editForm.excluded_topics.push(val);
  excludeInput.value = "";
}
function onExcludeKeydown(e: KeyboardEvent) {
  if (e.key === "," || e.key === "Enter") { e.preventDefault(); addExcludeTopic(); }
  if (e.key === "Backspace" && excludeInput.value === "") editForm.excluded_topics?.pop();
}

async function saveGoal() {
  if (!editForm.name?.trim()) { goalSaveErr.value = "Name is required"; return; }
  isSavingGoal.value = true;
  goalSaveErr.value  = "";
  goalSaveMsg.value  = "";
  try {
    await $fetch("/api/goals/update", { method: "POST", body: editForm });
    await refreshGoal();
    editGoalOpen.value = false;
    goalSaveMsg.value  = "Saved";
  } catch (err) {
    goalSaveErr.value = err instanceof Error ? err.message : "Save failed";
  } finally {
    isSavingGoal.value = false;
  }
}

// ─── Schedule Editor State ─────────────────────────────────────────────────────
const scheduleOpen      = ref(false);
const isSavingSchedule  = ref(false);
const schedSaveMsg      = ref("");
const schedSaveErr      = ref("");

const schedForm = reactive<{ enabled: boolean; frequency: "daily" | "weekly"; day: number; time: string }>({
  enabled: false, frequency: "weekly", day: 1, time: "09:00"
});

function openScheduleEditor() {
  const s = scheduleData.value;
  if (s) {
    schedForm.enabled   = s.enabled;
    schedForm.frequency = s.frequency;
    schedForm.day       = s.day;
    schedForm.time      = s.time;
  }
  schedSaveMsg.value  = "";
  schedSaveErr.value  = "";
  scheduleOpen.value  = true;
}

async function saveSchedule() {
  isSavingSchedule.value = true;
  schedSaveErr.value     = "";
  schedSaveMsg.value     = "";
  try {
    await $fetch("/api/schedule", { method: "POST", body: schedForm });
    await refreshSchedule();
    scheduleOpen.value     = false;
  } catch (err) {
    schedSaveErr.value = err instanceof Error ? err.message : "Save failed";
  } finally {
    isSavingSchedule.value = false;
  }
}

async function toggleAutoSearch() {
  const newEnabled = !scheduleData.value?.enabled;
  await $fetch("/api/schedule", {
    method: "POST",
    body: { ...schedForm, enabled: newEnabled, frequency: scheduleData.value?.frequency ?? "weekly", day: scheduleData.value?.day ?? 1, time: scheduleData.value?.time ?? "09:00" }
  });
  await refreshSchedule();
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const scheduleHuman = computed(() => {
  const s = scheduleData.value;
  if (!s?.enabled) return null;
  return s.frequency === "daily"
    ? `Daily at ${s.time}`
    : `${DAY_LABELS[s.day] ?? "?"} at ${s.time}`;
});

// ─── Job / Run State ───────────────────────────────────────────────────────────
const currentJobId  = ref<string | null>(null);
const currentJob    = ref<Job | null>(null);
const startingRun   = ref(false);
const pollError     = ref("");
const logCollapsed  = ref(false);
const logViewport   = ref<HTMLElement | null>(null);
const runDuration   = ref("");
const justCompleted = ref(false);
const displayLimit  = ref(20);
const historyOpen   = ref(false);
const showSetup     = ref(false);
const showReset     = ref(false);
const resetConfirm  = ref("");
const isResetting   = ref(false);
const resetMessage  = ref("");
const resetError    = ref("");
const LIMIT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

let pollTimer: ReturnType<typeof setInterval> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let consecutivePollErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 4;

const isRunning  = computed(() => currentJob.value?.status === "running");
const latestRun  = computed(() => historyData.value?.runs?.[0] ?? null);

const allHighlights = computed<HighlightItem[]>(() => [
  ...(highlightsData.value?.top_highlights ?? []),
  ...(highlightsData.value?.other_highlights ?? [])
]);
const streamedItems = computed<HighlightItem[]>(() =>
  [...(currentJob.value?.stream_items ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      rank: item.rank, title: item.title, url: item.url, score: item.score,
      impact_tag: computeImpactTag(item.title),
      why_it_matters: "AI insights being generated…", risks: "—", source: item.source ?? ""
    }))
);
const displayedItems = computed<HighlightItem[]>(() =>
  isRunning.value && streamedItems.value.length > 0 ? streamedItems.value : allHighlights.value
);
const visibleHighlights = computed(() => displayedItems.value.slice(0, displayLimit.value));

const stopDurationTimer = () => { if (durationTimer) { clearInterval(durationTimer); durationTimer = null; } };
const startDurationTimer = () => {
  stopDurationTimer();
  runDuration.value = "0s";
  durationTimer = setInterval(() => {
    if (!currentJob.value?.started_at) return;
    const ms = Date.now() - new Date(currentJob.value.started_at).getTime();
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    runDuration.value = m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, 1000);
};

const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
const scrollBottom = () => { if (logViewport.value) logViewport.value.scrollTop = logViewport.value.scrollHeight; };

const finishRun = async (patch?: Partial<Job>) => {
  stopPolling();
  stopDurationTimer();
  consecutivePollErrors = 0;
  if (patch && currentJob.value)
    currentJob.value = { ...currentJob.value, ...patch, ended_at: new Date().toISOString() };
  await Promise.all([refreshHistory(), refreshHighlights()]).catch(() => {});
  logCollapsed.value = true;
  justCompleted.value = true;
  setTimeout(() => { justCompleted.value = false; }, 6000);
};

const pollJob = async () => {
  if (!currentJobId.value) return;
  try {
    const job = await $fetch<Job>(`/api/runs/jobs/${currentJobId.value}`);
    currentJob.value = job;
    pollError.value = "";
    consecutivePollErrors = 0;
    if (job.status !== "running") await finishRun();
  } catch (err: unknown) {
    consecutivePollErrors++;
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || consecutivePollErrors >= MAX_CONSECUTIVE_ERRORS) {
      pollError.value = code === 404
        ? "Job not found — server may have restarted."
        : `Stopped after ${consecutivePollErrors} consecutive errors.`;
      await finishRun({ status: "failed", error: pollError.value });
    } else {
      pollError.value = `Poll error (${consecutivePollErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err instanceof Error ? err.message : String(err)}`;
    }
  }
};

const startRun = async () => {
  if (isRunning.value || startingRun.value) return;
  startingRun.value = true;
  justCompleted.value = false;
  logCollapsed.value = false;
  pollError.value = "";
  consecutivePollErrors = 0;
  stopPolling();
  stopDurationTimer();
  try {
    const res = await $fetch<{ id: string }>("/api/runs/start", {
      method: "POST", body: { mode: "manual", verbose: true, maxItems: displayLimit.value, goalName: activeGoalName.value ?? undefined }
    });
    currentJobId.value = res.id;
    currentJob.value = {
      id: res.id, mode: "manual", status: "running",
      started_at: new Date().toISOString(),
      ended_at: null, run_key: null, top_items: null,
      logs: ["[dashboard] run started"], error: null, stream_items: []
    };
    startDurationTimer();
    await pollJob();
    if (currentJob.value?.status === "running") {
      stopPolling();
      pollTimer = setInterval(pollJob, 900);
    }
  } finally {
    startingRun.value = false;
  }
};

const cancelRun = () => finishRun({ status: "failed", error: "Cancelled by user" });

const resetResultsData = async () => {
  resetMessage.value = "";
  resetError.value = "";
  if (resetConfirm.value.trim() !== "RESET RESULTS") {
    resetError.value = 'Type exactly "RESET RESULTS" to confirm.';
    return;
  }
  if (!confirm("Permanently delete all result data?")) return;
  isResetting.value = true;
  try {
    const res = await $fetch<{ deleted: Record<string, number> }>("/api/admin/reset-results", {
      method: "POST", body: { confirm: resetConfirm.value }
    });
    currentJob.value = null;
    currentJobId.value = null;
    stopPolling();
    stopDurationTimer();
    await Promise.all([refreshHistory(), refreshHighlights()]);
    resetMessage.value = Object.entries(res.deleted).map(([k, v]) => `${k}: ${v}`).join(", ");
    resetConfirm.value = "";
    showReset.value = false;
  } catch (err) {
    resetError.value = err instanceof Error ? err.message : "Reset failed";
  } finally {
    isResetting.value = false;
  }
};

watch(() => currentJob.value?.logs?.length, () => nextTick(scrollBottom));
onBeforeUnmount(() => { stopPolling(); stopDurationTimer(); });
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0f1a] text-slate-900 dark:text-slate-100 antialiased">

    <!-- ══ Header ═══════════════════════════════════════════════════════════════ -->
    <header class="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
      <div class="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="size-7 rounded-lg bg-blue-600 grid place-items-center text-white text-[11px] font-black">M</div>
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">Intelligence</span>
        </div>
        <div class="flex items-center gap-1.5">
          <NuxtLink
            to="/sources"
            class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >Sources</NuxtLink>
          <NuxtLink
            to="/wizard"
            class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >Wizard</NuxtLink>
          <NuxtLink
            to="/help"
            class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >Help</NuxtLink>
          <button
            class="size-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-sm"
            @click="toggleDark"
            :title="isDark ? 'Light mode' : 'Dark mode'"
          >{{ isDark ? '☀' : '☾' }}</button>
        </div>
      </div>
    </header>

    <div class="max-w-5xl mx-auto px-4 py-5 flex gap-5 items-start">

      <!-- ══ Goals Sidebar ══════════════════════════════════════════════════════ -->
      <aside class="w-48 flex-shrink-0 sticky top-16 hidden md:flex flex-col gap-2">
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Goals</span>
          </div>
          <!-- New Goal button -->
          <div class="px-2 py-2 border-b border-slate-100 dark:border-slate-800">
            <NuxtLink
              to="/wizard"
              class="w-full h-7 px-2 inline-flex items-center gap-1.5 rounded-lg text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <span class="text-sm leading-none">+</span> New Goal
            </NuxtLink>
          </div>
          <!-- Goals list -->
          <div class="py-1 max-h-80 overflow-y-auto">
            <div v-if="!goalsData?.goals?.length" class="px-3 py-3 text-[11px] text-slate-400 dark:text-slate-500 italic">
              No goals yet
            </div>
            <div
              v-for="goal in goalsData?.goals ?? []"
              :key="goal.name"
              class="group flex items-center gap-1 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <!-- Active indicator + name -->
              <button
                class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                @click="setActiveGoal(goal.name)"
              >
                <span
                  class="size-1.5 rounded-full flex-shrink-0 transition-colors"
                  :class="activeGoalName === goal.name ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'"
                ></span>
                <span
                  class="text-[11px] truncate transition-colors"
                  :class="activeGoalName === goal.name
                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400'"
                >{{ goal.name }}</span>
              </button>
              <!-- Actions -->
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <NuxtLink
                  :to="`/wizard?goal=${encodeURIComponent(goal.name)}`"
                  class="size-5 grid place-items-center rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-[10px]"
                  title="Edit goal"
                >✏</NuxtLink>
                <button
                  class="size-5 grid place-items-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-[10px]"
                  title="Delete goal"
                  @click="deleteGoal(goal.name)"
                >✕</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ══ Main Content ════════════════════════════════════════════════════════ -->
      <div class="flex-1 min-w-0 space-y-4">

      <!-- ══ Watch Panel ═══════════════════════════════════════════════════════ -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

        <!-- Goal summary row -->
        <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Watching</p>
            <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {{ goalData?.goalSpec?.name || "No goal configured" }}
            </h1>
            <!-- Tags display -->
            <div v-if="goalData?.goalSpec" class="mt-1.5 flex flex-wrap gap-1">
              <span
                v-for="t in goalData.goalSpec.focus_topics"
                :key="t"
                class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-medium"
              >#{{ t }}</span>
              <span
                v-for="t in goalData.goalSpec.excluded_topics"
                :key="t"
                class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-medium line-through"
              >{{ t }}</span>
              <span
                v-if="!goalData.goalSpec.focus_topics?.length && !goalData.goalSpec.excluded_topics?.length"
                class="text-[11px] text-slate-400 dark:text-slate-500 italic"
              >No keyword filter — watching everything</span>
            </div>
            <div v-if="goalData?.goalSpec" class="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Lookback {{ goalData.goalSpec.lookback_days }}d · Max {{ goalData.goalSpec.max_items }} results
            </div>
          </div>
          <button
            class="flex-shrink-0 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            @click="editGoalOpen ? (editGoalOpen = false) : openGoalEditor()"
          >{{ editGoalOpen ? 'Close' : 'Edit Goal' }}</button>
        </div>

        <!-- ── Inline Goal Editor ────────────────────────────────────────────── -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150"
          leave-from-class="opacity-100" leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="editGoalOpen" class="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 bg-slate-50/60 dark:bg-slate-800/20">

            <!-- Name -->
            <div>
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Watch Name</label>
              <input
                v-model="editForm.name"
                type="text"
                placeholder="e.g. Climate Tech Monitor"
                class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>

            <!-- Focus Keywords -->
            <div>
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Focus Keywords <span class="text-slate-400 font-normal">(leave empty to watch everything)</span>
              </label>
              <div class="flex flex-wrap gap-1.5 p-2 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-400/50 cursor-text">
                <span
                  v-for="(tag, idx) in editForm.focus_topics"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium"
                >
                  {{ tag }}
                  <button @click.stop="editForm.focus_topics?.splice(idx, 1)" class="text-blue-400 hover:text-blue-600 leading-none">×</button>
                </span>
                <input
                  v-model="focusInput"
                  class="flex-1 min-w-20 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600"
                  placeholder="Add keyword, press Enter or comma…"
                  @keydown="onFocusKeydown($event)"
                  @blur="addFocusTopic()"
                />
              </div>
            </div>

            <!-- Exclude Topics -->
            <div>
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Exclude Topics</label>
              <div class="flex flex-wrap gap-1.5 p-2 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-400/50 cursor-text">
                <span
                  v-for="(tag, idx) in editForm.excluded_topics"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium line-through"
                >
                  {{ tag }}
                  <button @click.stop="editForm.excluded_topics?.splice(idx, 1)" class="text-slate-400 hover:text-slate-600 leading-none" style="text-decoration:none">×</button>
                </span>
                <input
                  v-model="excludeInput"
                  class="flex-1 min-w-20 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600"
                  placeholder="e.g. sports, celebrity…"
                  @keydown="onExcludeKeydown($event)"
                  @blur="addExcludeTopic()"
                />
              </div>
            </div>

            <!-- Lookback + Max Items -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Lookback Days</label>
                <select
                  v-model="editForm.lookback_days"
                  class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                >
                  <option :value="1">1 day</option>
                  <option :value="3">3 days</option>
                  <option :value="7">7 days</option>
                  <option :value="14">14 days</option>
                  <option :value="30">30 days</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Max Results</label>
                <select
                  v-model="editForm.max_items"
                  class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                >
                  <option v-for="n in [5, 10, 15, 20, 25, 30, 40, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-1">
              <div>
                <p v-if="goalSaveErr" class="text-xs text-red-500">{{ goalSaveErr }}</p>
                <p v-if="goalSaveMsg" class="text-xs text-emerald-600 dark:text-emerald-400">✓ {{ goalSaveMsg }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  class="h-8 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  @click="editGoalOpen = false"
                >Cancel</button>
                <button
                  class="h-8 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  :disabled="isSavingGoal"
                  @click="saveGoal"
                >{{ isSavingGoal ? 'Saving…' : 'Save & Apply' }}</button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ── Action Bar ──────────────────────────────────────────────────── -->
        <div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3 flex-wrap">

          <!-- Search Now button -->
          <button
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isRunning || startingRun"
            @click="startRun()"
          >
            <span class="text-base leading-none">{{ (isRunning || startingRun) ? '⏳' : '▶' }}</span>
            {{ startingRun ? 'Starting…' : isRunning ? 'Running…' : 'Search Now' }}
          </button>

          <!-- Auto-search toggle -->
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">Auto-search</span>
            <button
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="scheduleData?.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
              role="switch"
              :aria-checked="scheduleData?.enabled"
              @click="toggleAutoSearch()"
              :title="scheduleData?.enabled ? 'Disable auto-search' : 'Enable auto-search'"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                :class="scheduleData?.enabled ? 'translate-x-4' : 'translate-x-0'"
              ></span>
            </button>
            <span v-if="scheduleHuman" class="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ scheduleHuman }}</span>
            <button
              class="h-7 w-7 grid place-items-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm"
              @click="scheduleOpen ? (scheduleOpen = false) : openScheduleEditor()"
              title="Configure schedule"
            >⚙</button>
          </div>

          <!-- Results limit -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">Show</span>
            <select
              v-model="displayLimit"
              class="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
              <option v-for="n in LIMIT_OPTIONS" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>

        <!-- ── Inline Schedule Editor ─────────────────────────────────────── -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150"
          leave-from-class="opacity-100" leave-to-class="opacity-0"
        >
          <div v-if="scheduleOpen" class="border-t border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 bg-slate-50/60 dark:bg-slate-800/20">
            <div class="flex items-center justify-between mb-1">
              <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Schedule Configuration</p>
            </div>

            <!-- Enabled toggle -->
            <div class="flex items-center gap-3">
              <button
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                :class="schedForm.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
                @click="schedForm.enabled = !schedForm.enabled"
              >
                <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200" :class="schedForm.enabled ? 'translate-x-4' : 'translate-x-0'"></span>
              </button>
              <span class="text-sm text-slate-600 dark:text-slate-400">{{ schedForm.enabled ? 'Auto-search enabled' : 'Auto-search disabled' }}</span>
            </div>

            <div v-if="schedForm.enabled" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Frequency</label>
                <select v-model="schedForm.frequency" class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div v-if="schedForm.frequency === 'weekly'">
                <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Day</label>
                <select v-model="schedForm.day" class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                  <option v-for="(label, idx) in DAY_LABELS" :key="idx" :value="idx">{{ label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Time</label>
                <input v-model="schedForm.time" type="time" class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
              </div>
            </div>

            <div class="flex items-center justify-between pt-1">
              <div>
                <p v-if="schedSaveErr" class="text-xs text-red-500">{{ schedSaveErr }}</p>
              </div>
              <div class="flex gap-2">
                <button class="h-8 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" @click="scheduleOpen = false">Cancel</button>
                <button class="h-8 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50" :disabled="isSavingSchedule" @click="saveSchedule">{{ isSavingSchedule ? 'Saving…' : 'Save' }}</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ══ Success Banner ════════════════════════════════════════════════════ -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="justCompleted" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-sm">
          <span class="size-4 rounded-full bg-emerald-500 grid place-items-center text-white text-[9px] font-black flex-shrink-0">✓</span>
          Run completed — results updated
        </div>
      </Transition>

      <!-- ══ Live Terminal ══════════════════════════════════════════════════════ -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-[0.99]"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="currentJob" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <div class="flex items-center gap-3">
              <div class="flex gap-1">
                <div class="size-2.5 rounded-full bg-red-400"></div>
                <div class="size-2.5 rounded-full bg-amber-400"></div>
                <div class="size-2.5 rounded-full bg-emerald-400"></div>
              </div>
              <span class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ currentJob.mode }}</span>
              <span v-if="isRunning && runDuration" class="text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">{{ runDuration }}</span>
            </div>
            <div class="flex items-center gap-2">
              <p v-if="pollError && !isRunning" class="text-[11px] text-amber-600 dark:text-amber-400 max-w-xs truncate">{{ pollError }}</p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" :class="badgeClass(currentJob.status)">
                <span class="size-1.5 rounded-full" :class="dotClass(currentJob.status)"></span>
                {{ currentJob.status }}
              </span>
              <button v-if="isRunning" class="h-6 px-2 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" @click="cancelRun">Cancel</button>
              <button class="h-6 px-2 rounded-md text-slate-400 dark:text-slate-500 text-[10px] font-medium hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" @click="logCollapsed = !logCollapsed">{{ logCollapsed ? 'Expand' : 'Collapse' }}</button>
            </div>
          </div>
          <div v-show="!logCollapsed" ref="logViewport" class="bg-slate-950 min-h-36 max-h-72 overflow-y-auto p-3.5">
            <pre class="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{{ (currentJob?.logs ?? []).join('\n') || '…' }}</pre>
          </div>
        </div>
      </Transition>

      <!-- ══ No Results for Goal Empty State ══════════════════════════════════ -->
      <div
        v-if="!highlightsData?.has_data && !isRunning && streamedItems.length === 0 && activeGoalName"
        class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-10 text-center"
      >
        <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">No results for "{{ activeGoalName }}" yet</p>
        <p class="text-xs text-slate-400 dark:text-slate-500">Start a run with this goal active to see highlights here.</p>
      </div>

      <!-- ══ Results (Executive Brief + Items) ════════════════════════════════ -->
      <div v-if="highlightsData?.has_data || streamedItems.length > 0" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

        <!-- Header -->
        <div class="px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span v-if="isRunning && streamedItems.length > 0" class="text-[10px] font-medium text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-amber-400 animate-pulse"></span>Live Preview
            </span>
            <span v-else class="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Latest Results</span>
            <span class="font-mono text-[10px] text-slate-300 dark:text-slate-600">·</span>
            <span class="font-mono text-[10px] text-slate-400 dark:text-slate-500">{{ highlightsData?.run_key }}</span>
            <span v-if="highlightsData?.status" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" :class="badgeClass(highlightsData?.status)">
              <span class="size-1 rounded-full" :class="dotClass(highlightsData?.status)"></span>
              {{ highlightsData?.status }}
            </span>
            <button class="ml-auto h-6 px-2 rounded-md text-[11px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors" :disabled="false" @click="refreshHighlights()">↻</button>
          </div>
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-1">
            {{ (isRunning && streamedItems.length > 0) ? "Run in progress — results streaming live…" : highlightsData?.headline }}
          </h2>
          <p v-if="!(isRunning && streamedItems.length > 0)" class="text-sm text-slate-500 dark:text-slate-400">{{ highlightsData?.key_message }}</p>
        </div>

        <!-- Summary + Critical Updates -->
        <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 text-sm">
          <div class="px-4 py-3">
            <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Summary</p>
            <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">{{ highlightsData?.executive_summary || '—' }}</p>
          </div>
          <div class="px-4 py-3">
            <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Key Updates</p>
            <ul class="space-y-1.5">
              <li v-for="(item, i) in highlightsData?.critical_updates ?? []" :key="i" class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span class="mt-1.5 size-1 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0"></span>
                {{ item }}
              </li>
              <li v-if="!highlightsData?.critical_updates?.length" class="text-xs text-slate-400">—</li>
            </ul>
          </div>
        </div>

        <!-- Source warnings -->
        <div v-if="highlightsData?.warnings?.length" class="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
          <p class="text-xs text-amber-600 dark:text-amber-500"><span class="font-medium">Source warnings:</span> {{ highlightsData.warnings.join(' · ') }}</p>
        </div>

        <!-- Results list -->
        <div v-if="displayedItems.length" class="divide-y divide-slate-50 dark:divide-slate-800/50">
          <div class="px-4 py-1.5 flex items-center bg-slate-50/60 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              Showing {{ Math.min(displayLimit, displayedItems.length) }} of {{ displayedItems.length }}
              <span v-if="isRunning && streamedItems.length > 0" class="ml-1 text-amber-400 dark:text-amber-500">· AI insights pending</span>
            </span>
          </div>

          <!-- TOP 3 — green highlight -->
          <div
            v-for="(item, idx) in visibleHighlights.slice(0, 3)"
            :key="item.url"
            class="px-4 py-4 flex items-start gap-3 group bg-emerald-50/40 dark:bg-emerald-900/10"
            :class="idx < 2 ? 'border-b border-emerald-100/60 dark:border-emerald-900/20' : ''"
          >
            <span class="size-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 grid place-items-center flex-shrink-0">{{ item.rank }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded" :class="tagClass(item.impact_tag)">{{ item.impact_tag }}</span>
                <span v-if="item.source" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">{{ item.source.replace(/_/g, ' ') }}</span>
                <span class="text-[10px] font-mono text-slate-300 dark:text-slate-600 tabular-nums">{{ item.score }}</span>
              </div>
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug mb-2">{{ item.title }}</p>
              <div class="space-y-0.5">
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"><span class="text-slate-400 dark:text-slate-500">Why · </span>{{ item.why_it_matters }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 leading-relaxed"><span class="text-slate-300 dark:text-slate-600">Risk · </span>{{ item.risks }}</p>
              </div>
            </div>
            <a :href="item.url" target="_blank" rel="noopener noreferrer" class="flex-shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-0.5 whitespace-nowrap">
              Source <span class="text-[10px]">↗</span>
            </a>
          </div>

          <!-- Separator -->
          <div v-if="visibleHighlights.length > 3" class="px-4 py-2 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-800/30">
            <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">More</span>
            <span class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></span>
            <span class="text-[10px] text-slate-300 dark:text-slate-600">{{ visibleHighlights.length - 3 }} results</span>
          </div>

          <!-- RANK 4+ -->
          <div
            v-for="(item, idx) in visibleHighlights.slice(3)"
            :key="item.url"
            class="px-4 py-4 flex items-start gap-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
            :class="idx < visibleHighlights.slice(3).length - 1 ? 'border-b border-slate-50 dark:border-slate-800/50' : ''"
          >
            <span class="size-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 grid place-items-center flex-shrink-0">{{ item.rank }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded" :class="tagClass(item.impact_tag)">{{ item.impact_tag }}</span>
                <span v-if="item.source" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">{{ item.source.replace(/_/g, ' ') }}</span>
                <span class="text-[10px] font-mono text-slate-300 dark:text-slate-600 tabular-nums">{{ item.score }}</span>
              </div>
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug mb-2">{{ item.title }}</p>
              <div class="space-y-0.5">
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"><span class="text-slate-400 dark:text-slate-500">Why · </span>{{ item.why_it_matters }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 leading-relaxed"><span class="text-slate-300 dark:text-slate-600">Risk · </span>{{ item.risks }}</p>
              </div>
            </div>
            <a :href="item.url" target="_blank" rel="noopener noreferrer" class="flex-shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-0.5 whitespace-nowrap">
              Source <span class="text-[10px]">↗</span>
            </a>
          </div>
        </div>

        <div v-else class="px-4 py-8 text-center text-xs text-slate-400">No results in this run.</div>
      </div>

      <!-- Empty state (no runs yet) -->
      <div v-else class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-10 text-center">
        <p class="text-xl mb-2">🔍</p>
        <p class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No results yet</p>
        <p class="text-xs text-slate-400 dark:text-slate-500">Click <strong>Search Now</strong> to run your first search.</p>
      </div>

      <!-- ══ Run History ════════════════════════════════════════════════════════ -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
          @click="historyOpen = !historyOpen"
        >
          <h3 class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Run History</h3>
          <div class="flex items-center gap-2">
            <span v-if="latestRun" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" :class="badgeClass(latestRun.status)">
              <span class="size-1 rounded-full" :class="dotClass(latestRun.status)"></span>
              {{ latestRun.status }}
            </span>
            <span class="text-xs text-slate-300 dark:text-slate-600">{{ historyOpen ? '▲' : '▼' }}</span>
          </div>
        </button>
        <div v-if="historyOpen">
          <div class="border-t border-slate-100 dark:border-slate-800 flex items-center justify-end px-4 py-1.5">
            <button class="h-6 px-2 rounded-md text-[11px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors disabled:opacity-40" :disabled="historyPending" @click="refreshHistory()">↻ Refresh</button>
          </div>
          <div v-if="historyData?.runs?.length" class="border-t border-slate-100 dark:border-slate-800">
            <div
              v-for="run in historyData.runs"
              :key="run.run_key"
              class="border-b border-slate-50 dark:border-slate-800/40 last:border-none"
            >
              <!-- Run row (clickable to expand) -->
              <button
                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors text-left"
                @click="run.status === 'completed' && toggleRun(run.run_key)"
                :class="run.status !== 'completed' ? 'cursor-default' : 'cursor-pointer'"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate">{{ run.run_key }}</p>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{{ fmt(run.generated_at) }}</p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wide hidden sm:inline">{{ run.mode }}</span>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" :class="badgeClass(run.status)">
                    <span class="size-1 rounded-full" :class="dotClass(run.status)"></span>
                    {{ run.status }}
                  </span>
                  <span class="text-[10px] font-mono text-slate-300 dark:text-slate-600 hidden md:inline tabular-nums">{{ run.top_count ?? '—' }}/{{ run.total_candidates ?? '—' }}</span>
                  <span v-if="run.status === 'completed'" class="text-[10px] text-slate-300 dark:text-slate-600 ml-1">{{ expandedRuns.has(run.run_key) ? '▲' : '▼' }}</span>
                </div>
              </button>

              <!-- Expanded run results -->
              <div v-if="expandedRuns.has(run.run_key)" class="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/10">
                <!-- Loading -->
                <div v-if="loadingRuns.has(run.run_key)" class="px-4 py-3 flex items-center gap-2">
                  <span class="size-3 rounded-full bg-blue-400 animate-pulse"></span>
                  <span class="text-[11px] text-slate-400">Loading results…</span>
                </div>
                <!-- Error -->
                <div v-else-if="runHighlights[run.run_key] === null" class="px-4 py-3 text-[11px] text-red-400">
                  Could not load results for this run.
                </div>
                <!-- Results -->
                <div v-else-if="runHighlights[run.run_key]" class="px-4 py-3 space-y-2">
                  <p class="text-[11px] italic text-slate-500 dark:text-slate-400 leading-snug">
                    {{ runHighlights[run.run_key]!.headline }}
                  </p>
                  <div class="space-y-1">
                    <a
                      v-for="item in runHighlights[run.run_key]!.top_items"
                      :key="item.url"
                      :href="item.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-start gap-2 group"
                    >
                      <span class="text-[10px] font-mono text-slate-300 dark:text-slate-600 pt-0.5 flex-shrink-0 w-4 text-right">{{ item.rank }}</span>
                      <span class="text-[11px] text-blue-600 dark:text-blue-400 group-hover:underline leading-snug flex-1 min-w-0">{{ item.title }}</span>
                      <span v-if="item.source" class="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:inline">{{ item.source }}</span>
                      <span class="text-[10px] font-mono text-slate-300 dark:text-slate-600 flex-shrink-0">{{ item.score?.toFixed(2) }}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="px-4 py-6 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">No runs yet.</div>
        </div>
      </div>

      <!-- ══ Setup & Danger Zone (collapsible) ═══════════════════════════════ -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
          @click="showSetup = !showSetup"
        >
          <h3 class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Setup & Maintenance</h3>
          <span class="text-xs text-slate-300 dark:text-slate-600">{{ showSetup ? '▲' : '▼' }}</span>
        </button>

        <div v-if="showSetup" class="border-t border-slate-100 dark:border-slate-800 p-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Setup steps -->
            <div>
              <p class="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">Initial Setup</p>
              <ol class="space-y-2.5">
                <li v-for="(step, i) in [
                  { title: 'Install dependencies', code: 'pnpm install' },
                  { title: 'Configure environment', code: 'cp .env.example .env' },
                  { title: 'Provision and seed', code: 'pnpm setup' },
                  { title: 'Start all apps', code: 'pnpm dev' }
                ]" :key="i" class="flex items-start gap-2.5">
                  <span class="size-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400 grid place-items-center flex-shrink-0 mt-0.5">{{ i+1 }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{{ step.title }}</p>
                    <pre class="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 overflow-x-auto">{{ step.code }}</pre>
                  </div>
                </li>
              </ol>
            </div>
            <!-- Recovery -->
            <div>
              <p class="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">Recovery</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">Full reset when Directus schema is inconsistent:</p>
              <pre class="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-slate-300 overflow-x-auto leading-relaxed">pnpm docker:down
docker volume rm micha-mvp_postgres_data
pnpm setup</pre>
              <p class="mt-2 text-[11px] text-amber-600 dark:text-amber-500">⚠ Destroys all database volumes.</p>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="rounded-xl border border-red-100 dark:border-red-900/30 p-4">
            <button
              class="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 mb-1"
              @click="showReset = !showReset; resetMessage = ''; resetError = ''"
            >
              <span class="text-[10px] font-medium text-red-400 uppercase tracking-wider">Danger Zone</span>
              <span class="text-slate-300 dark:text-slate-600">{{ showReset ? '▲' : '▼' }}</span>
            </button>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">Delete all result data (<code class="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">ai_runs, ai_run_items, ai_feedback, ai_discovery_answers, ai_sources</code>). Configuration is preserved.</p>
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-150"
              leave-from-class="opacity-100" leave-to-class="opacity-0"
            >
              <div v-if="showReset" class="flex gap-2 mt-2">
                <input v-model="resetConfirm" type="text" placeholder="Type RESET RESULTS" class="flex-1 min-w-0 h-8 px-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-400 dark:focus:ring-red-600" />
                <button class="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50" :disabled="isResetting" @click="resetResultsData">{{ isResetting ? 'Deleting…' : 'Delete All' }}</button>
              </div>
            </Transition>
            <p v-if="resetMessage" class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ {{ resetMessage }}</p>
            <p v-if="resetError" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ resetError }}</p>
          </div>
        </div>
      </div>

      </div><!-- end main content -->
    </div><!-- end flex container -->
  </div>
</template>
