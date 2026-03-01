import { randomUUID } from "node:crypto";
import { validateGoalSpec, validateSourcePolicy } from "@mvp/schemas";
import {
  dedupeItems,
  DirectusClient,
  rankItems,
  defaultGoalSpec,
  defaultSourcePolicy,
  type NormalizedItem
} from "@mvp/shared";
import { fetchApi } from "../connectors/api";
import { fetchRss } from "../connectors/rss";
import { generateInsights } from "./openai";
import { buildMarkdownReport } from "./report";

const ensureAtLeastOneCitation = (items: NormalizedItem[]): NormalizedItem[] => {
  return items.filter((item) => (item.citation_urls?.length ?? 0) > 0);
};

export const runPipeline = async (args: {
  mode: "pilot" | "manual" | "scheduled";
  directus: DirectusClient;
  openAiApiKey: string;
  openAiModel: string;
  verbose?: boolean;
  maxItems?: number;
  goalName?: string;
  onProgress?: (message: string, level?: "info" | "debug") => void;
}): Promise<{ runKey: string; topCount: number }> => {
  const log = (message: string) => args.onProgress?.(message, "info");
  const debug = (message: string) => {
    if (args.verbose) {
      args.onProgress?.(message, "debug");
    }
  };
  const startedAt = Date.now();
  const runKey = `${new Date().toISOString()}_${args.mode}_${randomUUID().slice(0, 8)}`;
  log(`Run initialized (${args.mode}) with key ${runKey}`);

  log("Loading GoalSpec and SourcePolicy from Directus...");
  const rawGoalSpec = args.goalName
    ? await args.directus.listByName("ai_goal_specs", args.goalName, "goal_json")
    : await args.directus.listLatest("ai_goal_specs", "goal_json");
  const latestPolicy = await args.directus.listLatest("ai_source_policies", "policy_json");

  const goalSpec = validateGoalSpec(rawGoalSpec ?? defaultGoalSpec());
  const sourcePolicy = validateSourcePolicy(latestPolicy ?? defaultSourcePolicy());
  log(
    `Config loaded: goal=\"${goalSpec.name}\" (v${goalSpec.version}), sourcePolicy=\"${sourcePolicy.name}\" (v${sourcePolicy.version})`
  );
  debug(`Goal focus topics: ${goalSpec.focus_topics.join(", ")}`);
  debug(`Goal must include keywords: ${goalSpec.must_include_keywords.join(", ")}`);

  log(`Materializing ${sourcePolicy.sources.length} source definitions into ai_sources...`);
  await args.directus.createSourcesSnapshot(
    sourcePolicy.sources.map((source) => ({
      source_id: source.id,
      type: source.type,
      url: source.url,
      enabled: source.enabled,
      weight: source.weight,
      policy_name: sourcePolicy.name,
      policy_version: sourcePolicy.version,
      last_seen_at: new Date().toISOString()
    }))
  );

  const enabledSources = sourcePolicy.sources.filter((source) => source.enabled);
  const collected: NormalizedItem[] = [];
  const sourceWarnings: string[] = [];
  log(`Fetching enabled sources: ${enabledSources.length}/${sourcePolicy.sources.length}`);

  for (const source of enabledSources) {
    try {
      log(`Fetching source ${source.id} (${source.type})...`);
      debug(`Source ${source.id} URL: ${source.url}`);
      if (source.type === "rss") {
        const items = await fetchRss(source.id, source.url);
        collected.push(...items);
        log(`Source ${source.id}: fetched ${items.length} items`);
      } else if (source.type === "api") {
        const items = await fetchApi(source.id, source.url);
        collected.push(...items);
        log(`Source ${source.id}: fetched ${items.length} items`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceWarnings.push(`[${source.id}] ${message}`);
      log(`Source ${source.id}: failed (${message})`);
    }
  }

  if (collected.length === 0) {
    throw new Error(`No source items fetched. Source warnings: ${sourceWarnings.join(" | ")}`);
  }
  log(`Fetch complete: ${collected.length} raw items`);

  const deduped = dedupeItems(collected, sourcePolicy.dedupe);
  log(`Dedupe complete: ${deduped.length} items remain`);
  const ranked = rankItems(deduped, goalSpec, sourcePolicy);
  log(`Ranking complete: ${ranked.length} scored items`);
  const citeable = ensureAtLeastOneCitation(ranked);
  log(`Cite-or-omit filter: ${citeable.length} citeable items`);
  const itemLimit = args.maxItems ?? goalSpec.max_items;
  const topItems = citeable.slice(0, itemLimit);
  log(`Top selection: ${topItems.length} items`);
  // Stream each ranked item so the dashboard can show results in real-time
  for (let i = 0; i < topItems.length; i++) {
    const item = topItems[i];
    log(`[STREAM_ITEM] ${JSON.stringify({ rank: i + 1, title: item.title, url: item.url, score: item.score ?? 0, source: item.source_id })}`);
  }
  debug(
    `Top item titles: ${
      topItems.length ? topItems.map((item) => `${item.title} (${item.score ?? 0})`).join(" | ") : "none"
    }`
  );

  const insights =
    topItems.length > 0
      ? await generateInsights({
          apiKey: args.openAiApiKey,
          model: args.openAiModel,
          items: topItems
        })
      : {
          executive_summary: "No citeable items available for this run.",
          item_insights: [],
          audit: {
            model: "none",
            prompt: "",
            parameters: { temperature: 1 },
            response: ""
          }
        };
  if (topItems.length > 0) {
    log(`OpenAI insights generated for ${topItems.length} items`);
    debug(`OpenAI model used: ${insights.audit.model}`);
  } else {
    log("Skipping OpenAI insights because there are no top items");
  }

  const insightsById = new Map(insights.item_insights.map((item) => [item.id, item]));
  const enriched = topItems.map((item) => {
    const ai = insightsById.get(item.id);
    return {
      ...item,
      why_it_matters: ai?.why_it_matters ?? "No explanation generated.",
      risks: ai?.risks ?? "No risks identified."
    };
  });

  const markdown = buildMarkdownReport({
    runKey,
    mode: args.mode,
    executiveSummary: insights.executive_summary,
    topItems: enriched
  });
  log("Markdown report generated");

  log("Persisting run record to Directus...");
  await args.directus.createRun({
    run_key: runKey,
    mode: args.mode,
    status: "completed",
    goal_name: goalSpec.name,
    report_markdown: markdown,
    report_json: {
      goal_name: goalSpec.name,
      generated_at: new Date().toISOString(),
      total_candidates: deduped.length,
      top_count: enriched.length,
      source_warnings: sourceWarnings,
      openai_audit: insights.audit
    }
  });

  log(`Persisting ${enriched.length} run items to Directus...`);
  await args.directus.createItems(
    enriched.map((item) => ({
      run_key: runKey,
      title: item.title,
      url: item.url,
      source: item.source_id,
      published_at: item.published_at,
      summary: item.summary,
      score: item.score,
      why_it_matters: item.why_it_matters,
      risks: item.risks,
      citations: item.citation_urls
    }))
  );
  log("Run persistence complete");
  if (sourceWarnings.length > 0) {
    debug(`Source warnings: ${sourceWarnings.join(" | ")}`);
  }
  debug(`Run finished in ${Date.now() - startedAt}ms`);

  return {
    runKey,
    topCount: enriched.length
  };
};
