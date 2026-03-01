<script setup lang="ts">
import type { GoalSpec } from "@mvp/schemas";
// Ref is auto-imported by Nuxt/Vue, no explicit import needed

// ─── Types ───────────────────────────────────────────────────────────────────
type SuggestedSource = {
  url: string;
  type: "rss" | "api";
  label: string;
  weight: number;
  reason: string;
  valid: boolean;
  feed_title?: string | null;
  item_count?: number;
  error?: string;
};

// ─── Dark mode ────────────────────────────────────────────────────────────────
const isDark = ref(false);
onMounted(() => {
  const stored = localStorage.getItem("color-mode");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  isDark.value = stored !== null ? stored === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", isDark.value);
});
const toggleDark = () => {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("color-mode", isDark.value ? "dark" : "light");
};

// ─── Route ────────────────────────────────────────────────────────────────────
const route = useRoute();
const router = useRouter();
const editingGoalName = computed(() => route.query.goal as string | undefined);
const isEditing = computed(() => !!editingGoalName.value);
const pageTitle = computed(() => isEditing.value ? "Edit Goal" : "New Goal");

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    key: "general",
    label: "General Watch",
    values: {
      name: "General Watch",
      focus_topics: [] as string[],
      excluded_topics: [] as string[],
      must_include_keywords: [] as string[],
      target_audience: "General",
      lookback_days: 7,
      max_items: 20
    }
  },
  {
    key: "ai_tech",
    label: "AI & Tech",
    values: {
      name: "AI Strategy Watch",
      focus_topics: ["ai", "agent", "llm", "automation"],
      excluded_topics: ["sports", "celebrity"],
      must_include_keywords: ["ai", "model"],
      target_audience: "Executive team",
      lookback_days: 7,
      max_items: 15
    }
  },
  {
    key: "engineering",
    label: "Engineering",
    values: {
      name: "Engineering Trends Watch",
      focus_topics: ["developer tools", "infrastructure", "llmops", "testing"],
      excluded_topics: ["gaming", "politics"],
      must_include_keywords: ["sdk", "deployment", "reliability"],
      target_audience: "Engineering management",
      lookback_days: 14,
      max_items: 10
    }
  },
  {
    key: "go_to_market",
    label: "Go-to-Market",
    values: {
      name: "GTM Intelligence Watch",
      focus_topics: ["saas", "pricing", "demand generation", "sales"],
      excluded_topics: [],
      must_include_keywords: ["revenue", "growth"],
      target_audience: "Marketing leadership",
      lookback_days: 7,
      max_items: 15
    }
  },
  {
    key: "science",
    label: "Science & Research",
    values: {
      name: "Science Watch",
      focus_topics: ["research", "paper", "arxiv", "study", "breakthrough"],
      excluded_topics: [],
      must_include_keywords: [],
      target_audience: "Research team",
      lookback_days: 30,
      max_items: 20
    }
  },
  {
    key: "security",
    label: "Security & Privacy",
    values: {
      name: "Security Watch",
      focus_topics: ["security", "vulnerability", "privacy", "breach", "cve"],
      excluded_topics: [],
      must_include_keywords: [],
      target_audience: "Engineering management",
      lookback_days: 3,
      max_items: 20
    }
  }
] as const;

// ─── Form state ───────────────────────────────────────────────────────────────
const form = reactive({
  name: "",
  focus_topics: [] as string[],
  excluded_topics: [] as string[],
  must_include_keywords: [] as string[],
  target_audience: "General",
  lookback_days: 7,
  max_items: 20
});

const focusInput   = ref("");
const excludeInput = ref("");
const keywordInput = ref("");

function removeTag(list: string[], idx: number) {
  list.splice(idx, 1);
}

// Per-field tag helpers (avoids ref auto-unwrap issue in Vue 3 templates)
function addFocusTag() {
  const v = focusInput.value.replace(/,/g, "").trim().toLowerCase();
  if (v && !form.focus_topics.includes(v)) form.focus_topics.push(v);
  focusInput.value = "";
}
function onFocusKeydown(e: KeyboardEvent) {
  if (e.key === "," || e.key === "Enter") { e.preventDefault(); addFocusTag(); }
  if (e.key === "Backspace" && focusInput.value === "") form.focus_topics.pop();
}
function addExcludeTag() {
  const v = excludeInput.value.replace(/,/g, "").trim().toLowerCase();
  if (v && !form.excluded_topics.includes(v)) form.excluded_topics.push(v);
  excludeInput.value = "";
}
function onExcludeKeydown(e: KeyboardEvent) {
  if (e.key === "," || e.key === "Enter") { e.preventDefault(); addExcludeTag(); }
  if (e.key === "Backspace" && excludeInput.value === "") form.excluded_topics.pop();
}
function addKeywordTag() {
  const v = keywordInput.value.replace(/,/g, "").trim().toLowerCase();
  if (v && !form.must_include_keywords.includes(v)) form.must_include_keywords.push(v);
  keywordInput.value = "";
}
function onKeywordKeydown(e: KeyboardEvent) {
  if (e.key === "," || e.key === "Enter") { e.preventDefault(); addKeywordTag(); }
  if (e.key === "Backspace" && keywordInput.value === "") form.must_include_keywords.pop();
}

// ─── Load existing goal if editing ────────────────────────────────────────────
const { data: existingGoal } = await useFetch<{ goalSpec: GoalSpec }>(
  () => editingGoalName.value
    ? `/api/goals/latest?name=${encodeURIComponent(editingGoalName.value)}`
    : null,
  { immediate: !!editingGoalName.value }
);

watch(existingGoal, (data) => {
  if (data?.goalSpec) populateForm(data.goalSpec);
}, { immediate: true });

function populateForm(spec: GoalSpec) {
  form.name = spec.name;
  form.focus_topics = [...(spec.focus_topics ?? [])];
  form.excluded_topics = [...(spec.excluded_topics ?? [])];
  form.must_include_keywords = [...(spec.must_include_keywords ?? [])];
  form.target_audience = spec.target_audience ?? "General";
  form.lookback_days = spec.lookback_days ?? 7;
  form.max_items = spec.max_items ?? 20;
}

function applyTemplate(key: string) {
  const tpl = TEMPLATES.find(t => t.key === key);
  if (!tpl) return;
  const v = tpl.values;
  form.name = v.name;
  form.focus_topics = [...v.focus_topics];
  form.excluded_topics = [...v.excluded_topics];
  form.must_include_keywords = [...v.must_include_keywords];
  form.target_audience = v.target_audience;
  form.lookback_days = v.lookback_days;
  form.max_items = v.max_items;
}

// ─── Source Discovery ────────────────────────────────────────────────────────
const showDiscovery      = ref(false);
const isDiscovering      = ref(false);
const discoveryError     = ref("");
const discoveredSources  = ref<SuggestedSource[]>([]);
const selectedSources    = ref<Set<number>>(new Set());
const isAddingSources    = ref(false);
const addSourcesMsg      = ref("");
const savedGoalName      = ref("");

function toggleSourceSelection(idx: number) {
  const next = new Set(selectedSources.value);
  if (next.has(idx)) next.delete(idx);
  else next.add(idx);
  selectedSources.value = next;
}

function selectAllValid() {
  const next = new Set<number>();
  discoveredSources.value.forEach((s, i) => { if (s.valid) next.add(i); });
  selectedSources.value = next;
}

function deselectAll() {
  selectedSources.value = new Set();
}

async function discoverSources() {
  isDiscovering.value = true;
  discoveryError.value = "";
  discoveredSources.value = [];
  selectedSources.value = new Set();
  addSourcesMsg.value = "";

  try {
    const res = await $fetch<{ suggestions: SuggestedSource[]; existing_count: number }>("/api/sources/discover", {
      method: "POST",
      body: {
        goal_name: form.name.trim(),
        focus_topics: form.focus_topics,
        must_include_keywords: form.must_include_keywords,
        target_audience: form.target_audience
      }
    });
    discoveredSources.value = res.suggestions;
    // Auto-select all valid sources
    const validIdxs = new Set<number>();
    res.suggestions.forEach((s, i) => { if (s.valid) validIdxs.add(i); });
    selectedSources.value = validIdxs;
  } catch (err) {
    discoveryError.value = err instanceof Error ? err.message : "Discovery failed";
  } finally {
    isDiscovering.value = false;
  }
}

async function addSelectedSources() {
  const toAdd = [...selectedSources.value]
    .map((i) => discoveredSources.value[i])
    .filter((s) => s && s.valid);

  if (toAdd.length === 0) return;
  isAddingSources.value = true;
  addSourcesMsg.value = "";

  try {
    const res = await $fetch<{ added: number }>("/api/sources/bulk-add", {
      method: "POST",
      body: {
        sources: toAdd.map((s) => ({
          url: s.url,
          type: s.type,
          label: s.label,
          weight: s.weight
        }))
      }
    });
    addSourcesMsg.value = `Added ${res.added} source${res.added !== 1 ? "s" : ""} to your feed policy.`;
    selectedSources.value = new Set();
  } catch (err) {
    addSourcesMsg.value = err instanceof Error ? err.message : "Failed to add sources";
  } finally {
    isAddingSources.value = false;
  }
}

function skipDiscovery() {
  showDiscovery.value = false;
  router.push(`/?goal=${encodeURIComponent(savedGoalName.value)}`);
}

function finishWithSources() {
  showDiscovery.value = false;
  router.push(`/?goal=${encodeURIComponent(savedGoalName.value)}`);
}

const selectedValidCount = computed(() => {
  return [...selectedSources.value].filter((i) => discoveredSources.value[i]?.valid).length;
});

// ─── Save ─────────────────────────────────────────────────────────────────────
const isSaving  = ref(false);
const saveError = ref("");
const nameError = ref("");

async function save() {
  nameError.value = "";
  saveError.value = "";
  if (!form.name.trim()) { nameError.value = "Goal name is required."; return; }
  if (form.name.trim().length < 3) { nameError.value = "Name must be at least 3 characters."; return; }

  isSaving.value = true;
  try {
    const res = await $fetch<{ goalSpec: GoalSpec }>("/api/goals/update", {
      method: "POST",
      body: { ...form, name: form.name.trim() }
    });
    savedGoalName.value = res.goalSpec.name;

    // After saving, show the source discovery panel and auto-trigger discovery
    showDiscovery.value = true;
    discoverSources();
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Save failed";
  } finally {
    isSaving.value = false;
  }
}

const AUDIENCE_OPTIONS = [
  "General", "Executive team", "Product leadership",
  "Engineering management", "Marketing leadership", "Research team"
];
const LOOKBACK_OPTIONS = [1, 3, 7, 14, 30, 60];
const activeTemplate = ref<string | null>(null);
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0f1a] text-slate-900 dark:text-slate-100 antialiased">

    <!-- ══ Header ══════════════════════════════════════════════════════════════ -->
    <header class="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
      <div class="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <NuxtLink to="/" class="size-7 rounded-lg bg-blue-600 grid place-items-center text-white text-[11px] font-black hover:bg-blue-700 transition-colors">M</NuxtLink>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">·</span>
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ pageTitle }}</span>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            ← Dashboard
          </NuxtLink>
          <NuxtLink to="/help" class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            Help
          </NuxtLink>
          <button
            class="size-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-sm"
            @click="toggleDark"
          >{{ isDark ? '☀' : '☾' }}</button>
        </div>
      </div>
    </header>

    <div class="max-w-2xl mx-auto px-4 py-8 space-y-5">

      <!-- ══ Source Discovery Panel (shown after save) ═════════════════════ -->
      <template v-if="showDiscovery">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">Source Discovery</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Goal "{{ savedGoalName }}" saved. Finding the best sources for your topics...
          </p>
        </div>

        <div class="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10 overflow-hidden">

          <!-- Loading state -->
          <div v-if="isDiscovering" class="px-4 py-10 text-center">
            <div class="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Discovering relevant sources with AI...
            </div>
            <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">This may take a few seconds while we find and validate feeds.</p>
          </div>

          <!-- Error state -->
          <div v-else-if="discoveryError" class="px-4 py-6 text-center space-y-3">
            <p class="text-sm text-red-500">{{ discoveryError }}</p>
            <div class="flex items-center justify-center gap-2">
              <button @click="discoverSources()" class="h-8 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Retry
              </button>
              <button @click="skipDiscovery()" class="h-8 px-4 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Skip
              </button>
            </div>
          </div>

          <!-- Results -->
          <template v-else-if="discoveredSources.length > 0">
            <div class="px-4 py-3 border-b border-blue-100 dark:border-blue-800/30 flex items-center justify-between">
              <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {{ discoveredSources.filter(s => s.valid).length }} valid sources found
              </p>
              <div class="flex items-center gap-2">
                <button @click="selectAllValid()" class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">Select all</button>
                <span class="text-slate-300 dark:text-slate-600">|</span>
                <button @click="deselectAll()" class="text-[11px] text-slate-400 hover:underline">Deselect</button>
              </div>
            </div>

            <div class="divide-y divide-blue-50 dark:divide-blue-900/20">
              <div
                v-for="(source, idx) in discoveredSources"
                :key="source.url"
                class="px-4 py-3 flex items-start gap-3 transition-colors"
                :class="source.valid ? 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20' : 'opacity-50'"
              >
                <!-- Checkbox -->
                <div class="pt-0.5">
                  <button
                    class="size-5 rounded border-2 grid place-items-center transition-colors text-[10px] font-bold"
                    :class="selectedSources.has(idx)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : source.valid
                        ? 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                        : 'border-slate-200 dark:border-slate-700 cursor-not-allowed'"
                    :disabled="!source.valid"
                    @click="toggleSourceSelection(idx)"
                  >
                    <span v-if="selectedSources.has(idx)">&#10003;</span>
                  </button>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{{ source.feed_title || source.label }}</p>
                    <span
                      class="text-[9px] font-medium px-1.5 py-0.5 rounded"
                      :class="source.valid
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'"
                    >{{ source.valid ? 'Valid' : source.error || 'Invalid' }}</span>
                    <span v-if="source.item_count" class="text-[9px] text-slate-400">{{ source.item_count }} items</span>
                  </div>
                  <p class="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">{{ source.url }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{{ source.reason }}</p>
                  <div class="flex items-center gap-3 mt-1">
                    <span class="text-[10px] text-slate-400">Weight: {{ source.weight.toFixed(2) }}</span>
                    <span
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      :class="source.type === 'api'
                        ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                    >{{ source.type.toUpperCase() }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Success message -->
            <div v-if="addSourcesMsg" class="px-4 py-2 text-center">
              <p class="text-xs" :class="addSourcesMsg.startsWith('Added') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">{{ addSourcesMsg }}</p>
            </div>

            <!-- Actions -->
            <div class="px-4 py-3 border-t border-blue-100 dark:border-blue-800/30 flex items-center justify-between bg-blue-50/30 dark:bg-blue-900/5">
              <button
                @click="skipDiscovery()"
                class="h-8 px-4 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >{{ addSourcesMsg ? 'Go to Dashboard' : 'Skip' }}</button>
              <div class="flex items-center gap-2">
                <button
                  v-if="addSourcesMsg"
                  @click="finishWithSources()"
                  class="h-8 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >Done</button>
                <button
                  v-else
                  @click="addSelectedSources()"
                  :disabled="isAddingSources || selectedValidCount === 0"
                  class="h-8 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >{{ isAddingSources ? 'Adding...' : `Add ${selectedValidCount} Source${selectedValidCount !== 1 ? 's' : ''}` }}</button>
              </div>
            </div>
          </template>

          <!-- No results -->
          <div v-else class="px-4 py-8 text-center space-y-3">
            <p class="text-sm text-slate-500 dark:text-slate-400">No new sources found for this goal.</p>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">Your existing sources may already cover these topics, or try adding more specific focus keywords.</p>
            <button
              @click="skipDiscovery()"
              class="h-8 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >Go to Dashboard</button>
          </div>
        </div>
      </template>

      <!-- ══ Normal wizard form (hidden during discovery) ═════════════════ -->
      <template v-else>

      <!-- ══ Page heading ════════════════════════════════════════════════════ -->
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ isEditing ? `Editing "${editingGoalName}" — changes create a new version.` : "Define what your intelligence watch monitors." }}
        </p>
      </div>

      <!-- ══ Templates ═══════════════════════════════════════════════════════ -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quick templates</p>
        </div>
        <div class="px-4 py-3 flex flex-wrap gap-2">
          <button
            v-for="tpl in TEMPLATES"
            :key="tpl.key"
            @click="applyTemplate(tpl.key); activeTemplate = tpl.key"
            :class="[
              'h-7 px-3 rounded-full text-xs font-medium border transition-colors',
              activeTemplate === tpl.key
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
            ]"
          >{{ tpl.label }}</button>
        </div>
      </div>

      <!-- ══ Form ════════════════════════════════════════════════════════════ -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">

        <!-- Goal Name -->
        <div class="px-4 py-4 space-y-1.5">
          <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Goal Name <span class="text-red-400">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="e.g. Climate Tech Watch"
            class="w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-colors"
            :class="nameError ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'"
          />
          <p v-if="nameError" class="text-[11px] text-red-500">{{ nameError }}</p>
        </div>

        <!-- Focus Keywords -->
        <div class="px-4 py-4 space-y-1.5">
          <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Focus Keywords</label>
          <p class="text-[11px] text-slate-400 dark:text-slate-500">Items matching these topics rank higher. Leave empty to watch everything.</p>
          <div class="flex flex-wrap gap-1.5 p-2 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-400/50 cursor-text"
               @click="($refs.focusRef as HTMLInputElement)?.focus()">
            <span
              v-for="(tag, i) in form.focus_topics"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium"
            >{{ tag }}<button type="button" @click.stop="removeTag(form.focus_topics, i)" class="hover:text-red-500 leading-none">×</button></span>
            <input
              ref="focusRef"
              v-model="focusInput"
              type="text"
              placeholder="Add keyword, press Enter or comma…"
              class="flex-1 min-w-[120px] bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 outline-none"
              @keydown="onFocusKeydown($event)"
              @blur="addFocusTag()"
            />
          </div>
        </div>

        <!-- Excluded Topics -->
        <div class="px-4 py-4 space-y-1.5">
          <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Exclude Topics</label>
          <p class="text-[11px] text-slate-400 dark:text-slate-500">Items mentioning these topics are filtered out.</p>
          <div class="flex flex-wrap gap-1.5 p-2 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-400/50 cursor-text"
               @click="($refs.excludeRef as HTMLInputElement)?.focus()">
            <span
              v-for="(tag, i) in form.excluded_topics"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium line-through decoration-red-400"
            >{{ tag }}<button type="button" @click.stop="removeTag(form.excluded_topics, i)" class="hover:text-red-500 leading-none no-underline" style="text-decoration:none">×</button></span>
            <input
              ref="excludeRef"
              v-model="excludeInput"
              type="text"
              placeholder="Add topic to exclude…"
              class="flex-1 min-w-[120px] bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 outline-none"
              @keydown="onExcludeKeydown($event)"
              @blur="addExcludeTag()"
            />
          </div>
        </div>

        <!-- Required Keywords -->
        <div class="px-4 py-4 space-y-1.5">
          <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Required Keywords</label>
          <p class="text-[11px] text-slate-400 dark:text-slate-500">Items must include these keywords (optional boost filter).</p>
          <div class="flex flex-wrap gap-1.5 p-2 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-400/50 cursor-text"
               @click="($refs.keywordRef as HTMLInputElement)?.focus()">
            <span
              v-for="(tag, i) in form.must_include_keywords"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium"
            >{{ tag }}<button type="button" @click.stop="removeTag(form.must_include_keywords, i)" class="hover:text-red-500 leading-none">×</button></span>
            <input
              ref="keywordRef"
              v-model="keywordInput"
              type="text"
              placeholder="Add required keyword…"
              class="flex-1 min-w-[120px] bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 outline-none"
              @keydown="onKeywordKeydown($event)"
              @blur="addKeywordTag()"
            />
          </div>
        </div>

        <!-- Settings row -->
        <div class="px-4 py-4 grid grid-cols-3 gap-4">
          <!-- Audience -->
          <div class="space-y-1.5">
            <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Audience</label>
            <select
              v-model="form.target_audience"
              class="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <option v-for="opt in AUDIENCE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- Lookback -->
          <div class="space-y-1.5">
            <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lookback</label>
            <select
              v-model="form.lookback_days"
              class="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <option v-for="d in LOOKBACK_OPTIONS" :key="d" :value="d">{{ d }}d</option>
            </select>
          </div>
          <!-- Max Items -->
          <div class="space-y-1.5">
            <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max items</label>
            <input
              v-model.number="form.max_items"
              type="number"
              min="5"
              max="50"
              class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="px-4 py-3 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/10">
          <NuxtLink
            to="/"
            class="h-8 px-4 inline-flex items-center rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >Cancel</NuxtLink>
          <div class="flex items-center gap-3">
            <p v-if="saveError" class="text-xs text-red-500">{{ saveError }}</p>
            <button
              @click="save"
              :disabled="isSaving"
              class="h-8 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >{{ isSaving ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Goal') }}</button>
          </div>
        </div>
      </div>

      <!-- ══ Tip ═════════════════════════════════════════════════════════════ -->
      <div class="rounded-lg border border-slate-100 dark:border-slate-800 px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        <strong class="text-slate-500 dark:text-slate-400">Tip:</strong>
        After saving, the system will automatically discover and suggest relevant RSS feeds for your goal topics.
        You can review and add them with one click — or skip and manage sources manually.
      </div>

      </template>
    </div>
  </div>
</template>
