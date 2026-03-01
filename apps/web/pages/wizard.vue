<script setup lang="ts">
import type { GoalSpec } from "@mvp/schemas";
// Ref is auto-imported by Nuxt/Vue, no explicit import needed

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
    await router.push(`/?goal=${encodeURIComponent(res.goalSpec.name)}`);
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
        Leave all keyword fields empty for a broad signal watch — the system will return the highest-scoring items from your active sources regardless of topic.
        Each save creates a new versioned record, so you can always see what changed over time.
      </div>

    </div>
  </div>
</template>
