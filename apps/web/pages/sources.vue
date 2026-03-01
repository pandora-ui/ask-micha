<script setup lang="ts">
type Source = {
  id: string;
  label: string;
  type: "rss" | "api";
  url: string;
  enabled: boolean;
  weight: number;
};

type ValidationResult = {
  valid: boolean;
  title?: string | null;
  itemCount?: number;
  error?: string;
};

// ─── Dark Mode (sync with main page) ─────────────────────────────────────────
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

// ─── Data ─────────────────────────────────────────────────────────────────────
const { data: sourcesData, refresh: refreshSources } = await useFetch<{ sources: Source[] }>("/api/sources", {
  default: () => ({ sources: [] })
});

const sources = computed(() => sourcesData.value?.sources ?? []);
const enabledCount = computed(() => sources.value.filter((s) => s.enabled).length);

// ─── Toggle / Edit actions ────────────────────────────────────────────────────
const pendingToggle = ref<string | null>(null);
const pendingDelete = ref<string | null>(null);

async function toggleSource(id: string, enabled: boolean) {
  pendingToggle.value = id;
  try {
    await $fetch(`/api/sources/${id}`, { method: "PATCH", body: { enabled } });
    await refreshSources();
  } finally {
    pendingToggle.value = null;
  }
}

async function deleteSource(id: string, label: string) {
  if (!confirm(`Remove "${label}"? This cannot be undone.`)) return;
  pendingDelete.value = id;
  try {
    await $fetch(`/api/sources/${id}`, { method: "DELETE" });
    await refreshSources();
  } catch (err) {
    alert(err instanceof Error ? err.message : "Delete failed");
  } finally {
    pendingDelete.value = null;
  }
}

// ─── Add Source Form ──────────────────────────────────────────────────────────
const addOpen      = ref(false);
const addUrl       = ref("");
const addLabel     = ref("");
const addType      = ref<"rss" | "api">("rss");
const addWeight    = ref(0.1);
const isAdding     = ref(false);
const addError     = ref("");
const isValidating = ref(false);
const validResult  = ref<ValidationResult | null>(null);

async function validateUrl() {
  if (!addUrl.value) return;
  isValidating.value = true;
  validResult.value  = null;
  try {
    validResult.value = await $fetch<ValidationResult>("/api/sources/validate", {
      method: "POST", body: { url: addUrl.value }
    });
    if (validResult.value?.title && !addLabel.value) {
      addLabel.value = validResult.value.title;
    }
  } catch {
    validResult.value = { valid: false, error: "Validation request failed" };
  } finally {
    isValidating.value = false;
  }
}

async function addSource() {
  if (!addUrl.value) { addError.value = "URL is required"; return; }
  isAdding.value = true;
  addError.value = "";
  try {
    await $fetch("/api/sources", {
      method: "POST",
      body: { label: addLabel.value || undefined, type: addType.value, url: addUrl.value, weight: addWeight.value }
    });
    await refreshSources();
    addOpen.value   = false;
    addUrl.value    = "";
    addLabel.value  = "";
    addType.value   = "rss";
    addWeight.value = 0.1;
    validResult.value = null;
  } catch (err) {
    addError.value = err instanceof Error ? err.message : "Failed to add source";
  } finally {
    isAdding.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0f1a] text-slate-900 dark:text-slate-100 antialiased">

    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <NuxtLink to="/" class="size-7 rounded-lg bg-blue-600 grid place-items-center text-white text-[11px] font-black hover:bg-blue-700 transition-colors">M</NuxtLink>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">·</span>
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Sources</span>
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

    <div class="max-w-4xl mx-auto px-4 py-5 space-y-4">

      <!-- Page header -->
      <div class="flex items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Source Management</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage the RSS feeds and APIs used during intelligence runs.
            <span class="font-medium text-slate-600 dark:text-slate-300">{{ enabledCount }} of {{ sources.length }}</span> active.
          </p>
        </div>
        <button
          class="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          @click="addOpen = !addOpen"
        >
          <span>{{ addOpen ? '✕' : '+' }}</span>
          {{ addOpen ? 'Cancel' : 'Add Source' }}
        </button>
      </div>

      <!-- Add source form (expandable) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="addOpen" class="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
          <h3 class="text-xs font-semibold text-slate-700 dark:text-slate-300">Add New Source</h3>

          <!-- URL row -->
          <div>
            <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Feed URL</label>
            <div class="flex gap-2">
              <input
                v-model="addUrl"
                type="url"
                placeholder="https://example.com/rss.xml"
                class="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                @keydown.enter.prevent="validateUrl()"
              />
              <button
                class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                :disabled="!addUrl || isValidating"
                @click="validateUrl()"
              >{{ isValidating ? 'Checking…' : 'Validate' }}</button>
            </div>
            <!-- Validation feedback -->
            <div v-if="validResult" class="mt-1.5 flex items-center gap-2 text-xs">
              <span v-if="validResult.valid" class="text-emerald-600 dark:text-emerald-400">
                ✓ Valid feed{{ validResult.title ? ` — "${validResult.title}"` : '' }}
                <span v-if="validResult.itemCount" class="text-slate-400"> ({{ validResult.itemCount }} items)</span>
              </span>
              <span v-else class="text-red-500">✕ {{ validResult.error }}</span>
            </div>
          </div>

          <!-- Label + Type + Weight row -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-1">
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Name (optional)</label>
              <input
                v-model="addLabel"
                type="text"
                placeholder="Auto-detected from feed"
                class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Type</label>
              <select v-model="addType" class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                <option value="rss">RSS</option>
                <option value="api">API</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Weight (0–1)</label>
              <input
                v-model.number="addWeight"
                type="number"
                min="0.01" max="1" step="0.01"
                class="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <p v-if="addError" class="text-xs text-red-500">{{ addError }}</p>
            <div class="ml-auto flex gap-2">
              <button class="h-8 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" @click="addOpen = false">Cancel</button>
              <button
                class="h-8 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                :disabled="isAdding || !addUrl"
                @click="addSource()"
              >{{ isAdding ? 'Adding…' : 'Add Source' }}</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Sources table -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

        <!-- Legend row -->
        <div class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20">
          <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Source</span>
          <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider w-12 text-center">Weight</span>
          <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider w-8 text-center">Type</span>
          <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider w-14 text-center">Active</span>
          <span class="w-8"></span>
        </div>

        <div v-if="sources.length">
          <div
            v-for="source in sources"
            :key="source.id"
            class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-slate-50 dark:border-slate-800/40 last:border-none transition-colors"
            :class="source.enabled ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20' : 'opacity-60 hover:opacity-80'"
          >
            <!-- Label + URL -->
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{{ source.label }}</p>
              <p class="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">{{ source.url }}</p>
            </div>

            <!-- Weight -->
            <span class="text-xs font-mono text-slate-500 dark:text-slate-400 w-12 text-center tabular-nums">{{ source.weight.toFixed(2) }}</span>

            <!-- Type badge -->
            <span
              class="text-[10px] font-medium px-1.5 py-0.5 rounded w-8 text-center"
              :class="source.type === 'api'
                ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
            >{{ source.type.toUpperCase() }}</span>

            <!-- Enable toggle -->
            <div class="w-14 flex justify-center">
              <button
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50"
                :class="source.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
                :disabled="pendingToggle === source.id"
                @click="toggleSource(source.id, !source.enabled)"
                :title="source.enabled ? 'Disable source' : 'Enable source'"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="source.enabled ? 'translate-x-4' : 'translate-x-0'"
                ></span>
              </button>
            </div>

            <!-- Delete -->
            <button
              class="w-8 h-8 grid place-items-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30"
              :disabled="pendingDelete === source.id"
              @click="deleteSource(source.id, source.label)"
              title="Remove source"
            >{{ pendingDelete === source.id ? '…' : '✕' }}</button>
          </div>
        </div>

        <div v-else class="px-4 py-10 text-center text-xs text-slate-400">
          No sources configured. Add one above.
        </div>
      </div>

      <!-- Help note -->
      <p class="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        Source changes take effect on the next run. At least 2 sources must remain active.
      </p>
    </div>
  </div>
</template>
