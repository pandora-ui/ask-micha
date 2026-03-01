<script setup lang="ts">
const isDark = ref(false);

onMounted(() => {
  const stored = localStorage.getItem("color-mode");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  isDark.value = stored !== null ? stored === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", isDark.value);
});

function toggleDark() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("color-mode", isDark.value ? "dark" : "light");
}

const activeTab = ref<"user" | "developer">("user");
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0a0f1a] text-slate-900 dark:text-slate-100 antialiased">

    <!-- ══ Header ══════════════════════════════════════════════════════════════ -->
    <header class="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <NuxtLink to="/" class="size-7 rounded-lg bg-blue-600 grid place-items-center text-white text-[11px] font-black hover:bg-blue-700 transition-colors">M</NuxtLink>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">·</span>
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Help</span>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            ← Dashboard
          </NuxtLink>
          <button
            class="size-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-sm"
            @click="toggleDark"
          >{{ isDark ? '☀' : '☾' }}</button>
        </div>
      </div>
    </header>

    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">

      <!-- ══ Page title ═══════════════════════════════════════════════════════ -->
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Help & Documentation</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Everything you need to set up and use the Intelligence system.</p>
      </div>

      <!-- ══ Tab switcher ══════════════════════════════════════════════════════ -->
      <div class="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 w-fit">
        <button
          @click="activeTab = 'user'"
          :class="[
            'h-8 px-4 rounded-md text-xs font-semibold transition-all',
            activeTab === 'user'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          ]"
        >User Guide</button>
        <button
          @click="activeTab = 'developer'"
          :class="[
            'h-8 px-4 rounded-md text-xs font-semibold transition-all',
            activeTab === 'developer'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          ]"
        >Developer Setup</button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           USER GUIDE
           ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'user'" class="space-y-4">

        <!-- What is this? -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">What is this system?</h2>
          </div>
          <div class="px-5 py-4 text-sm text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
            <p>This is a personal intelligence feed — an automated system that monitors RSS feeds and news APIs, scores and ranks everything based on your interests, and generates an AI-powered executive brief for you to review.</p>
            <p>You define <strong class="text-slate-700 dark:text-slate-300">what</strong> you want to watch (goal + keywords), <strong class="text-slate-700 dark:text-slate-300">which sources</strong> to pull from, and <strong class="text-slate-700 dark:text-slate-300">when</strong> to run automatically. Or trigger it manually any time.</p>
          </div>
        </div>

        <!-- Step-by-step usage -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Getting started — 4 steps</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-blue-600 text-white text-xs font-bold grid place-items-center">1</div>
              <div class="space-y-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Define your watch goal</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">On the dashboard, click <strong class="text-slate-600 dark:text-slate-300">Edit Goal</strong>. Enter a name for your watch (e.g. "Climate & Energy"), add focus keywords (e.g. <em>solar, EV, climate policy</em>), and optionally set topics to exclude. Choose how far back to look (Lookback) and how many results to return (Max Items). Click <strong class="text-slate-600 dark:text-slate-300">Save &amp; Apply</strong>.</p>
                <p class="text-[11px] text-slate-400 dark:text-slate-500">Tip: leaving keywords empty returns everything from all active sources — useful when you want a broad overview.</p>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-blue-600 text-white text-xs font-bold grid place-items-center">2</div>
              <div class="space-y-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Pick your sources</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Open the <NuxtLink to="/sources" class="text-blue-500 hover:underline">Sources</NuxtLink> page. Enable or disable feeds with the toggle — only enabled sources are fetched during a run. By default 6 general sources are active (Hacker News, GitHub Blog, Lobsters, a16z, Product Hunt). You can enable dozens more (ArXiv, OpenAI Blog, TechCrunch, etc.) or add your own RSS feed URL.</p>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-blue-600 text-white text-xs font-bold grid place-items-center">3</div>
              <div class="space-y-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Run a search</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Click <strong class="text-slate-600 dark:text-slate-300">Search Now</strong> on the dashboard. A live terminal appears showing progress — fetching sources, deduplicating, ranking, and generating AI insights. Once done, the results appear directly below.</p>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-blue-600 text-white text-xs font-bold grid place-items-center">4</div>
              <div class="space-y-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Enable automatic runs (optional)</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Toggle <strong class="text-slate-600 dark:text-slate-300">Auto-search</strong> in the action bar. Click <strong class="text-slate-600 dark:text-slate-300">⚙</strong> to configure the schedule — daily or weekly, with day and time. The server starts the run automatically at the configured time, even without the browser open.</p>
              </div>
            </div>

          </div>
        </div>

        <!-- Reading results -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Reading the results</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <div class="px-5 py-3 grid grid-cols-[120px,1fr] gap-3 items-start">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-0.5">Executive Brief</span>
              <span class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">AI-generated headline + key message summarizing the entire batch of results. Reads like a one-paragraph briefing from an analyst.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[120px,1fr] gap-3 items-start">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-0.5">Top Highlights</span>
              <span class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">The highest-scored items, each with a source tag and a direct link. Score is based on recency, keyword relevance, and source trust weight.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[120px,1fr] gap-3 items-start">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-0.5">All Results</span>
              <span class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Click "Show all N results" to expand. Each item shows a summary, why it matters, and potential risks.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[120px,1fr] gap-3 items-start">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-0.5">Run History</span>
              <span class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Collapsible table of past runs. Each row shows status, mode, timestamp, and item count.</span>
            </div>
          </div>
        </div>

        <!-- Source management -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Managing sources</h2>
          </div>
          <div class="px-5 py-4 text-sm text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
            <p>Go to <NuxtLink to="/sources" class="text-blue-500 hover:underline">Sources</NuxtLink> to manage all feeds. The system ships with 27 pre-configured feeds. Only the 6 general ones are enabled by default.</p>
            <div class="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden text-xs">
              <div class="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                <div class="px-4 py-3 space-y-1">
                  <p class="font-semibold text-slate-700 dark:text-slate-300 mb-2">Active by default</p>
                  <p class="text-slate-500 dark:text-slate-400">Hacker News (RSS + API)</p>
                  <p class="text-slate-500 dark:text-slate-400">Lobsters</p>
                  <p class="text-slate-500 dark:text-slate-400">GitHub Blog</p>
                  <p class="text-slate-500 dark:text-slate-400">a16z Blog</p>
                  <p class="text-slate-500 dark:text-slate-400">Product Hunt</p>
                </div>
                <div class="px-4 py-3 space-y-1">
                  <p class="font-semibold text-slate-700 dark:text-slate-300 mb-2">Available (disabled)</p>
                  <p class="text-slate-500 dark:text-slate-400">ArXiv (AI, ML, NLP, CV)</p>
                  <p class="text-slate-500 dark:text-slate-400">TechCrunch, The Verge AI</p>
                  <p class="text-slate-500 dark:text-slate-400">OpenAI, Anthropic, DeepMind</p>
                  <p class="text-slate-500 dark:text-slate-400">MIT, IEEE, VentureBeat</p>
                  <p class="text-slate-500 dark:text-slate-400">Reddit (ML, LocalLLaMA, AI)</p>
                </div>
              </div>
            </div>
            <p>To add a custom feed: paste any RSS or Atom URL in the "Add Source" section, click <strong class="text-slate-700 dark:text-slate-300">Validate</strong> to check it, then submit.</p>
          </div>
        </div>

        <!-- Scoring explained -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">How items are scored and ranked</h2>
          </div>
          <div class="px-5 py-4 space-y-3">
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Each item gets a deterministic score from three factors, then items are ranked highest-first:</p>
            <div class="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
              score = recency × 0.4 + relevance × 0.4 + source_trust × 0.2
            </div>
            <div class="space-y-2 text-xs">
              <div class="flex gap-3">
                <span class="w-28 flex-shrink-0 font-semibold text-slate-700 dark:text-slate-300">Recency (40%)</span>
                <span class="text-slate-500 dark:text-slate-400">How fresh the item is relative to your lookback window. An item published today scores 1.0; one published at the edge of the window scores ~0.</span>
              </div>
              <div class="flex gap-3">
                <span class="w-28 flex-shrink-0 font-semibold text-slate-700 dark:text-slate-300">Relevance (40%)</span>
                <span class="text-slate-500 dark:text-slate-400">Fraction of your focus keywords found in the title + summary. With no keywords configured, every item is fully relevant (1.0).</span>
              </div>
              <div class="flex gap-3">
                <span class="w-28 flex-shrink-0 font-semibold text-slate-700 dark:text-slate-300">Source trust (20%)</span>
                <span class="text-slate-500 dark:text-slate-400">The weight you assigned to the source on the Sources page (0.0–1.0). Higher weight = source results rank higher.</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           DEVELOPER GUIDE
           ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'developer'" class="space-y-4">

        <!-- Architecture overview -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Architecture overview</h2>
          </div>
          <div class="px-5 py-4 space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>This is a pnpm monorepo with three packages:</p>
            <div class="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <div class="px-4 py-3 grid grid-cols-[140px,1fr] gap-2">
                <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400">apps/web</code>
                <span>Nuxt 3 frontend + BFF. Dashboard, Sources page, Help. Runs in Node via Nitro. Also owns the cron scheduler (Nitro plugin).</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-[140px,1fr] gap-2">
                <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400">apps/worker</code>
                <span>CLI Node.js process. Executed as a child process by the web app (or directly via CLI). Runs the full pipeline and exits.</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-[140px,1fr] gap-2">
                <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400">packages/schemas</code>
                <span>AJV-based JSON Schema validators for <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">GoalSpec</code> and <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">SourcePolicy</code>.</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-[140px,1fr] gap-2">
                <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400">packages/shared</code>
                <span>Shared TypeScript: Directus client, scoring logic, dedupe, defaults. Used by both web and worker.</span>
              </div>
            </div>
            <p>External services: <strong class="text-slate-700 dark:text-slate-300">Directus + Postgres</strong> (stores all config + run data) and <strong class="text-slate-700 dark:text-slate-300">OpenAI API</strong> (generates summaries and insights).</p>
          </div>
        </div>

        <!-- Prerequisites -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Prerequisites</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <div class="px-5 py-3 grid grid-cols-[160px,1fr] gap-2 items-start text-xs">
              <div>
                <span class="font-semibold text-slate-700 dark:text-slate-300">Node.js &gt;= 20</span>
                <span class="ml-2 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-medium">Required</span>
              </div>
              <span class="text-slate-500 dark:text-slate-400">Install via <a href="https://nodejs.org" target="_blank" class="text-blue-500 hover:underline">nodejs.org</a> or <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">nvm</code> / <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">fnm</code>.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[160px,1fr] gap-2 items-start text-xs">
              <div>
                <span class="font-semibold text-slate-700 dark:text-slate-300">pnpm &gt;= 10</span>
                <span class="ml-2 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-medium">Required</span>
              </div>
              <span class="text-slate-500 dark:text-slate-400">Install: <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">npm i -g pnpm</code></span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[160px,1fr] gap-2 items-start text-xs">
              <div>
                <span class="font-semibold text-slate-700 dark:text-slate-300">Docker Desktop</span>
                <span class="ml-2 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-medium">Required</span>
              </div>
              <span class="text-slate-500 dark:text-slate-400">Runs Directus + Postgres. Install from <a href="https://www.docker.com/products/docker-desktop/" target="_blank" class="text-blue-500 hover:underline">docker.com</a>.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[160px,1fr] gap-2 items-start text-xs">
              <div>
                <span class="font-semibold text-slate-700 dark:text-slate-300">OpenAI API Key</span>
                <span class="ml-2 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-medium">Required</span>
              </div>
              <span class="text-slate-500 dark:text-slate-400">Create at <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-500 hover:underline">platform.openai.com/api-keys</a>. Used for generating executive summaries and item insights during each run.</span>
            </div>
            <div class="px-5 py-3 grid grid-cols-[160px,1fr] gap-2 items-start text-xs">
              <div>
                <span class="font-semibold text-slate-700 dark:text-slate-300">Git</span>
                <span class="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium">Recommended</span>
              </div>
              <span class="text-slate-500 dark:text-slate-400">To clone and manage the repository.</span>
            </div>
          </div>
        </div>

        <!-- Setup steps -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Setup — step by step</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold grid place-items-center">1</div>
              <div class="space-y-2 min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Clone the repository</p>
                <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">git clone &lt;repo-url&gt;
cd &lt;repo-folder&gt;</pre>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold grid place-items-center">2</div>
              <div class="space-y-2 min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Create your environment file</p>
                <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">cp .env.example .env</pre>
                <p class="text-xs text-slate-500 dark:text-slate-400">Then open <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.env</code> and fill in the required values:</p>
                <div class="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-orange-600 dark:text-orange-400">OPENAI_API_KEY</code>
                    <span class="text-slate-500 dark:text-slate-400">Your OpenAI API key — required for AI insights</span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-orange-600 dark:text-orange-400">OPENAI_MODEL</code>
                    <span class="text-slate-500 dark:text-slate-400">e.g. <code class="font-mono">gpt-4o-mini</code> or <code class="font-mono">gpt-4o</code></span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-slate-600 dark:text-slate-400">DIRECTUS_URL</code>
                    <span class="text-slate-500 dark:text-slate-400">Default: <code class="font-mono">http://localhost:8055</code> — leave as-is for local setup</span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-slate-600 dark:text-slate-400">DIRECTUS_ADMIN_TOKEN</code>
                    <span class="text-slate-500 dark:text-slate-400">Static API token for Directus — any secret string, e.g. <code class="font-mono">my-secret-token</code></span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-slate-600 dark:text-slate-400">ADMIN_EMAIL</code>
                    <span class="text-slate-500 dark:text-slate-400">Directus admin email — used for first-time setup</span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-slate-600 dark:text-slate-400">ADMIN_PASSWORD</code>
                    <span class="text-slate-500 dark:text-slate-400">Directus admin password</span>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[200px,1fr] gap-2">
                    <code class="font-mono text-[11px] text-slate-600 dark:text-slate-400">ADMIN_TOKEN</code>
                    <span class="text-slate-500 dark:text-slate-400">Same value as <code class="font-mono">DIRECTUS_ADMIN_TOKEN</code></span>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold grid place-items-center">3</div>
              <div class="space-y-2 min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Install dependencies</p>
                <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">pnpm install</pre>
                <p class="text-xs text-slate-500 dark:text-slate-400">Installs all workspace dependencies across all apps and packages.</p>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold grid place-items-center">4</div>
              <div class="space-y-2 min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Start infrastructure + provision + seed</p>
                <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">pnpm setup</pre>
                <p class="text-xs text-slate-500 dark:text-slate-400">This single command:</p>
                <ol class="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 list-decimal list-inside pl-1">
                  <li>Starts Directus + Postgres via Docker Compose</li>
                  <li>Waits for Directus to be ready</li>
                  <li>Creates all required collections and fields</li>
                  <li>Seeds the default project, source policy and sources</li>
                </ol>
                <p class="text-[11px] text-amber-600 dark:text-amber-400">Make sure Docker Desktop is running before this step.</p>
              </div>
            </div>

            <div class="px-5 py-4 flex gap-4">
              <div class="flex-shrink-0 size-7 rounded-full bg-emerald-600 text-white text-xs font-bold grid place-items-center">5</div>
              <div class="space-y-2 min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Start the dev server</p>
                <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">pnpm dev</pre>
                <div class="rounded-lg border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs overflow-hidden">
                  <div class="px-3 py-2 grid grid-cols-[140px,1fr] gap-2">
                    <span class="font-semibold text-slate-700 dark:text-slate-300">Dashboard</span>
                    <code class="font-mono text-[11px] text-blue-500">http://localhost:3000</code>
                  </div>
                  <div class="px-3 py-2 grid grid-cols-[140px,1fr] gap-2">
                    <span class="font-semibold text-slate-700 dark:text-slate-300">Directus admin</span>
                    <code class="font-mono text-[11px] text-blue-500">http://localhost:8055</code>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Key commands -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Key commands</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm dev</code>
              <span class="text-slate-500 dark:text-slate-400">Start all apps in dev mode (web + Directus)</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm setup</code>
              <span class="text-slate-500 dark:text-slate-400">First-time setup: Docker + provision + seed</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm --filter @mvp/worker manual</code>
              <span class="text-slate-500 dark:text-slate-400">Run the worker pipeline directly from CLI</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm --filter @mvp/worker manual -- --verbose</code>
              <span class="text-slate-500 dark:text-slate-400">Run with verbose output</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm --filter @mvp/worker schedule</code>
              <span class="text-slate-500 dark:text-slate-400">Start worker in schedule mode (reads cron from Directus)</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm --filter @mvp/schemas test</code>
              <span class="text-slate-500 dark:text-slate-400">Run schema validation tests</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[280px,1fr] gap-3 items-center">
              <code class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">pnpm run release:commit -- --message "..."</code>
              <span class="text-slate-500 dark:text-slate-400">Stage, commit, and generate release notes</span>
            </div>
          </div>
        </div>

        <!-- Data model -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Directus data model</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_goal_specs</code>
              <span class="text-slate-500 dark:text-slate-400">Versioned search goal records. Latest version is used for each run. Fields: name, version, goal_json (GoalSpec).</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_source_policies</code>
              <span class="text-slate-500 dark:text-slate-400">Versioned source configurations. Every sources page change creates a new version. Fields: name, version, policy_json (SourcePolicy).</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_projects</code>
              <span class="text-slate-500 dark:text-slate-400">Single record with schedule settings: schedule_cron, timezone, enabled flag.</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_runs</code>
              <span class="text-slate-500 dark:text-slate-400">One record per run: run_key, mode (manual/scheduled), status, report_markdown, report_json.</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_run_items</code>
              <span class="text-slate-500 dark:text-slate-400">Scored items per run: title, url, source, score, summary, why_it_matters, risks, citations.</span>
            </div>
            <div class="px-5 py-2.5 grid grid-cols-[200px,1fr] gap-3 items-start">
              <code class="font-mono text-[11px] text-purple-600 dark:text-purple-400">ai_sources</code>
              <span class="text-slate-500 dark:text-slate-400">Snapshot of source config per policy version.</span>
            </div>
          </div>
        </div>

        <!-- Troubleshooting -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Troubleshooting</h2>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800 text-xs">

            <div class="px-5 py-4 space-y-1.5">
              <p class="font-semibold text-slate-700 dark:text-slate-300">Run stays on "running" forever</p>
              <p class="text-slate-500 dark:text-slate-400">The job runner has a 10-minute timeout — it will eventually be marked as failed. If it happens repeatedly, check that <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">OPENAI_API_KEY</code> is valid and that Directus is reachable at <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">DIRECTUS_URL</code>.</p>
            </div>

            <div class="px-5 py-4 space-y-1.5">
              <p class="font-semibold text-slate-700 dark:text-slate-300">Nuxt import / cache errors on startup</p>
              <p class="text-slate-500 dark:text-slate-400">Clear the Nuxt cache and restart:</p>
              <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">rm -rf apps/web/.nuxt apps/web/.output
pnpm --filter @mvp/web dev</pre>
            </div>

            <div class="px-5 py-4 space-y-1.5">
              <p class="font-semibold text-slate-700 dark:text-slate-300">Directus not reachable / 401 errors</p>
              <p class="text-slate-500 dark:text-slate-400">Check that Docker is running (<code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">docker ps</code>) and that <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">DIRECTUS_ADMIN_TOKEN</code> in <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.env</code> matches the token set in <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">docker-compose.yml</code>.</p>
            </div>

            <div class="px-5 py-4 space-y-1.5">
              <p class="font-semibold text-slate-700 dark:text-slate-300">Schedule changes don't take effect</p>
              <p class="text-slate-500 dark:text-slate-400">The Nitro scheduler runs in the web server process. Changes via the dashboard update the cron task immediately — no restart needed. If the scheduler isn't running after a cold start, verify <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">DIRECTUS_URL</code> and <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">DIRECTUS_ADMIN_TOKEN</code> are set in <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.env</code>.</p>
            </div>

            <div class="px-5 py-4 space-y-1.5">
              <p class="font-semibold text-slate-700 dark:text-slate-300">Fresh DB / reprovisioning</p>
              <p class="text-slate-500 dark:text-slate-400">To reset everything (destroys all data):</p>
              <pre class="text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">docker compose down -v
pnpm setup</pre>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>
