import { getDirectusClient } from "../../utils/directus";

interface RunRecord {
  run_key: string;
  mode: string;
  status: string;
  report_markdown?: string;
  report_json?: {
    goal_name?: string;
    generated_at?: string;
    top_count?: number;
    total_candidates?: number;
    source_warnings?: string[];
  };
}

interface RunItem {
  title: string;
  url: string;
  score: number;
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
  why_it_matters: string;
  risks: string;
  source: string;
}

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
    why_it_matters: item.why_it_matters ?? "No insight available.",
    risks: item.risks ?? "No risk statement available.",
    source: item.source ?? ""
  }));
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const goalName = query.goal as string | undefined;
  const directus = getDirectusClient();

  try {
    // Fetch recent runs — filter by goal_name stored in report_json (JS-side, no schema dep)
    const recent = await directus.request<{ data: RunRecord[] }>(
      "/items/ai_runs?limit=50&sort=-run_key&fields=run_key,mode,status,report_markdown,report_json"
    );

    const runs = recent.data;
    let run: RunRecord | undefined;

    if (goalName) {
      // Prefer a run whose report_json.goal_name matches
      run = runs.find((r) => r.report_json?.goal_name === goalName);
      if (!run) {
        return {
          has_data: false,
          headline: "No results for this goal yet",
          key_message: `Start a run with "${goalName}" selected to see results here.`,
          executive_summary: "",
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
        critical_updates: [],
        top_highlights: [],
        other_highlights: [],
        warnings: []
      };
    }

    const runItems = await directus.request<{ data: RunItem[] }>(
      `/items/ai_run_items?filter[run_key][_eq]=${encodeURIComponent(run.run_key)}&sort=-score&limit=200&fields=title,url,score,why_it_matters,risks,source`
    );

    const ranked = runItems.data;
    const allHighlights = mapHighlights(ranked);
    const topHighlights = allHighlights.slice(0, 3);
    const otherHighlights = allHighlights.slice(3);

    const topCount = run.report_json?.top_count ?? ranked.length;
    const totalCandidates = run.report_json?.total_candidates ?? null;
    const exec = parseExecutiveSummary(run.report_markdown);

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
      generated_at: run.report_json?.generated_at ?? null,
      headline,
      key_message: keyMessage,
      executive_summary: exec,
      critical_updates: criticalUpdates,
      top_highlights: topHighlights,
      other_highlights: otherHighlights,
      warnings: run.report_json?.source_warnings ?? []
    };
  } catch {
    return {
      has_data: false,
      headline: "Highlights unavailable",
      key_message: "Run-Daten konnten aktuell nicht geladen werden.",
      executive_summary: "",
      critical_updates: [],
      top_highlights: [],
      other_highlights: [],
      warnings: []
    };
  }
});
