import { getDirectusClient } from "../../utils/directus";
import { translateManyTexts } from "../../utils/translate";

interface RunRecord {
  run_key: string;
  mode: string;
  status: string;
  goal_name?: string;
  report_markdown?: string;
  report_json?: {
    goal_name?: string;
    generated_at?: string;
    top_count?: number;
    total_candidates?: number;
    source_warnings?: string[];
  } | string;
}

interface RunItem {
  title: string;
  url: string;
  score: number;
  summary?: string;
  why_it_matters?: string;
  risks?: string;
  source?: string;
}

interface HighlightItem {
  rank: number;
  title: string;
  url: string;
  score: number;
  impact_tag: string;
  summary: string;
  summary_display: string;
  why_it_matters: string;
  why_it_matters_display: string;
  risks: string;
  risks_display: string;
  source: string;
}

type SupportedLanguage = "de" | "en";

type TranslationCacheEntry = {
  source_exec_summary: string;
  translated_exec_summary: string;
  translated_item_summaries: string[];
  translated_item_why: string[];
  translated_item_risks: string[];
};

const translationCache = new Map<string, TranslationCacheEntry>();
const MAX_CACHE_ENTRIES = 100;
const MAX_TRANSLATED_ITEM_SUMMARIES = 50;

const normalizeName = (value: string | undefined | null): string =>
  (value ?? "").trim().toLowerCase();

const asReportJson = (value: RunRecord["report_json"]): NonNullable<Exclude<RunRecord["report_json"], string>> => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed as NonNullable<Exclude<RunRecord["report_json"], string>>;
    } catch {
      return {};
    }
  }
  return value;
};

const parseExecutiveSummary = (markdown: string | undefined): string => {
  if (!markdown) return "No executive summary available.";
  const match = markdown.match(/## Executive Summary\s*([\s\S]*?)\s*## Top \d+/i);
  if (!match?.[1]) return "No executive summary available.";
  return match[1].trim().replace(/\n+/g, " ");
};

const impactTag = (title: string): string => {
  const t = title.toLowerCase();
  if (/model|llm|inference|benchmark|agent|copilot|multimodal/.test(t)) return "Model Shift";
  if (/fund|raise|valuation|acqui|merger|earnings|revenue/.test(t)) return "Market Move";
  if (/regulation|policy|compliance|law|eu|act|court|antitrust/.test(t)) return "Regulation";
  if (/deploy|rollout|launch|release|ship|introduc|ga|preview/.test(t)) return "Execution";
  if (/opensource|open source|github|repository|sdk|framework/.test(t)) return "Open Source";
  return "Signal";
};

const noveltyScore = (title: string): number => {
  const t = title.toLowerCase();
  let score = 0;
  if (/new|launch|release|introduc|breakthrough|first|major|ga|preview/.test(t)) score += 2;
  if (/regulation|law|policy|court|antitrust/.test(t)) score += 2;
  if (/fund|raise|acqui|merger|valuation/.test(t)) score += 1;
  if (/open source|opensource|github/.test(t)) score += 1;
  return score;
};

const mapHighlights = (items: RunItem[]): HighlightItem[] => {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((item, idx) => ({
    rank: idx + 1,
    title: item.title,
    url: item.url,
    score: item.score,
    impact_tag: impactTag(item.title),
    summary: item.summary?.trim() || "No page summary available.",
    summary_display: item.summary?.trim() || "No page summary available.",
    why_it_matters: item.why_it_matters ?? "No insight available.",
    why_it_matters_display: item.why_it_matters ?? "No insight available.",
    risks: item.risks ?? "No risk statement available.",
    risks_display: item.risks ?? "No risk statement available.",
    source: item.source ?? ""
  }));
};

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store, no-cache, must-revalidate");
  const query = getQuery(event);
  const goalName = query.goal as string | undefined;
  const language: SupportedLanguage = query.lang === "en" ? "en" : "de";
  const directus = getDirectusClient();
  const config = useRuntimeConfig();

  try {
    // Fetch recent runs — filter by goal_name stored in report_json (JS-side, no schema dep)
    const recent = await directus.request<{ data: RunRecord[] }>(
      "/items/ai_runs?limit=50&sort=-run_key&fields=run_key,mode,status,goal_name,report_markdown,report_json"
    );

    const runs = recent.data;
    let run: RunRecord | undefined;

    if (goalName) {
      // Match against top-level goal_name first; fallback to report_json.goal_name.
      const target = normalizeName(goalName);
      run = runs.find((r) => {
        const report = asReportJson(r.report_json);
        const topLevel = normalizeName(r.goal_name);
        const nested = normalizeName(report.goal_name);
        return topLevel === target || nested === target;
      });
      if (!run) {
        return {
          has_data: false,
          headline: "No results for this goal yet",
          key_message: `Start a run with "${goalName}" selected to see results here.`,
          executive_summary: "",
          executive_summary_display: "",
          selected_language: language,
          critical_updates: [],
          top_highlights: [],
          other_highlights: [],
          warnings: []
        };
      }
    } else {
      run = runs[0];
    }

    if (!run) {
      return {
        has_data: false,
        headline: "No run available yet",
        key_message: "Start a Pilot or Manual run to see highlights.",
        executive_summary: "",
        executive_summary_display: "",
        selected_language: language,
        critical_updates: [],
        top_highlights: [],
        other_highlights: [],
        warnings: []
      };
    }

    const runItems = await directus.request<{ data: RunItem[] }>(
      `/items/ai_run_items?filter[run_key][_eq]=${encodeURIComponent(run.run_key)}&sort=-score&limit=200&fields=title,url,score,summary,why_it_matters,risks,source`
    );

    const ranked = runItems.data;
    const allHighlights = mapHighlights(ranked);
    const topHighlights = allHighlights.slice(0, 3);
    const otherHighlights = allHighlights.slice(3);

    const report = asReportJson(run.report_json);
    const topCount = report.top_count ?? ranked.length;
    const totalCandidates = report.total_candidates ?? null;
    const exec = parseExecutiveSummary(run.report_markdown);
    let executiveSummaryDisplay = exec;

    if (language === "de") {
      const cacheKey = `${run.run_key}:${language}`;
      const summariesToTranslate = allHighlights
        .slice(0, MAX_TRANSLATED_ITEM_SUMMARIES)
        .map((item) => item.summary);
      const whyToTranslate = allHighlights
        .slice(0, MAX_TRANSLATED_ITEM_SUMMARIES)
        .map((item) => item.why_it_matters);
      const risksToTranslate = allHighlights
        .slice(0, MAX_TRANSLATED_ITEM_SUMMARIES)
        .map((item) => item.risks);

      let cached = translationCache.get(cacheKey);
      const cacheStale =
        !cached ||
        cached.source_exec_summary !== exec ||
        cached.translated_item_summaries.length !== summariesToTranslate.length ||
        cached.translated_item_why.length !== whyToTranslate.length ||
        cached.translated_item_risks.length !== risksToTranslate.length;

      if (cacheStale) {
        const translated = await translateManyTexts({
          texts: [exec, ...summariesToTranslate, ...whyToTranslate, ...risksToTranslate],
          to: language,
          apiKey: config.openAiApiKey
        });
        const summaryOffset = 1;
        const whyOffset = summaryOffset + summariesToTranslate.length;
        const riskOffset = whyOffset + whyToTranslate.length;

        cached = {
          source_exec_summary: exec,
          translated_exec_summary: translated[0] ?? exec,
          translated_item_summaries: translated.slice(summaryOffset, whyOffset),
          translated_item_why: translated.slice(whyOffset, riskOffset),
          translated_item_risks: translated.slice(riskOffset, riskOffset + risksToTranslate.length)
        };

        if (translationCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = translationCache.keys().next().value;
          if (oldestKey) translationCache.delete(oldestKey);
        }
        translationCache.set(cacheKey, cached);
      }

      executiveSummaryDisplay = cached.translated_exec_summary;
      allHighlights.forEach((item, idx) => {
        if (idx < cached.translated_item_summaries.length) {
          item.summary_display = cached.translated_item_summaries[idx] || item.summary;
        }
        if (idx < cached.translated_item_why.length) {
          item.why_it_matters_display = cached.translated_item_why[idx] || item.why_it_matters;
        }
        if (idx < cached.translated_item_risks.length) {
          item.risks_display = cached.translated_item_risks[idx] || item.risks;
        }
      });
    }

    const dominantThemes = topHighlights
      .map((x) => x.impact_tag)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .join(", ");

    const topNovelty = topHighlights.map((x) => noveltyScore(x.title)).reduce((a, b) => a + b, 0);

    const headline =
      topHighlights[0]?.title ??
      `Run ${run.run_key} completed with ${topCount} prioritized signals`;

    const keyMessage =
      run.status === "completed"
        ? `${topCount} Top-Signale aus ${totalCandidates ?? "?"} Kandidaten. Leitmotive: ${
            dominantThemes || "gemischte Signale"
          }. Neuigkeitsindex (Top-3): ${topNovelty}.`
        : `Run ${run.run_key} ist im Status ${run.status}.`;

    const criticalUpdates = topHighlights.map((item) => item.why_it_matters || item.title);

    return {
      has_data: true,
      run_key: run.run_key,
      mode: run.mode,
      status: run.status,
      generated_at: report.generated_at ?? null,
      headline,
      key_message: keyMessage,
      executive_summary: exec,
      executive_summary_display: executiveSummaryDisplay,
      selected_language: language,
      critical_updates: criticalUpdates,
      top_highlights: topHighlights,
      other_highlights: otherHighlights,
      warnings: report.source_warnings ?? []
    };
  } catch {
    return {
      has_data: false,
      headline: "Highlights unavailable",
      key_message: "Run-Daten konnten aktuell nicht geladen werden.",
      executive_summary: "",
      executive_summary_display: "",
      selected_language: language,
      critical_updates: [],
      top_highlights: [],
      other_highlights: [],
      warnings: []
    };
  }
});
