import { getDirectusClient } from "../../../utils/directus";

interface RunRecord {
  run_key: string;
  mode: string;
  status: string;
  report_markdown?: string;
  report_json?: {
    generated_at?: string;
    top_count?: number;
    total_candidates?: number;
  };
}

interface RunItem {
  title: string;
  url: string;
  score: number;
  source?: string;
  why_it_matters?: string;
}

const parseHeadline = (markdown: string | undefined, fallback: string): string => {
  if (!markdown) return fallback;
  const match = markdown.match(/^#+ (.+)/m);
  return match?.[1]?.trim() ?? fallback;
};

export default defineEventHandler(async (event) => {
  const runKey = decodeURIComponent(getRouterParam(event, "run_key") ?? "");
  if (!runKey) throw createError({ statusCode: 400, message: "run_key required" });

  const directus = getDirectusClient();

  const runRes = await directus.request<{ data: RunRecord[] }>(
    `/items/ai_runs?filter[run_key][_eq]=${encodeURIComponent(runKey)}&fields=run_key,mode,status,report_markdown,report_json&limit=1`
  );

  const run = runRes.data[0];
  if (!run) throw createError({ statusCode: 404, message: `Run "${runKey}" not found` });

  const itemsRes = await directus.request<{ data: RunItem[] }>(
    `/items/ai_run_items?filter[run_key][_eq]=${encodeURIComponent(runKey)}&sort=-score&limit=50&fields=title,url,score,source,why_it_matters`
  );

  const items = itemsRes.data;
  const topItems = items.slice(0, 5).map((item, idx) => ({
    rank: idx + 1,
    title: item.title,
    url: item.url,
    score: item.score,
    source: item.source ?? "",
    why_it_matters: item.why_it_matters ?? ""
  }));

  const headline = parseHeadline(
    run.report_markdown,
    topItems[0]?.title ?? `Run ${runKey}`
  );

  return {
    run_key: run.run_key,
    mode: run.mode,
    status: run.status,
    generated_at: run.report_json?.generated_at ?? null,
    top_count: run.report_json?.top_count ?? items.length,
    total_candidates: run.report_json?.total_candidates ?? null,
    headline,
    top_items: topItems
  };
});
