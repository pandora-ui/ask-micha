import { getDirectusClient } from "../../utils/directus";

/**
 * POST /api/runs/import
 *
 * Imports pre-generated content items as a completed run.
 * Used by the wizard when AI returns content mode results (e.g. movies, products)
 * so the dashboard can display them immediately without needing "Search Now".
 */

interface ImportItem {
  title: string;
  url: string;
  description?: string;
  source?: string;
  relevance?: string;
}

interface ImportRequest {
  goal_name: string;
  items: ImportItem[];
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as ImportRequest;

  if (!body.goal_name?.trim()) {
    throw createError({ statusCode: 400, message: "goal_name is required" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: "items array is required and must not be empty" });
  }

  const directus = getDirectusClient();
  const runKey = `import_${Date.now()}`;

  // Create the run record
  await directus.createRun({
    run_key: runKey,
    mode: "import",
    status: "completed",
    goal_name: body.goal_name.trim(),
    report_markdown: `## AI-Curated Results\n\nImported ${body.items.length} items for goal "${body.goal_name}".`,
    report_json: {
      goal_name: body.goal_name.trim(),
      generated_at: new Date().toISOString(),
      top_count: body.items.length,
      total_candidates: body.items.length,
      source_warnings: []
    }
  });

  // Create run items with scores based on position
  const items = body.items.slice(0, 50).map((item, idx) => ({
    run_key: runKey,
    title: item.title,
    url: item.url,
    source: item.source ?? "AI Import",
    published_at: new Date().toISOString(),
    summary: item.description ?? "",
    score: Math.max(0.1, 1 - idx * (0.9 / Math.max(body.items.length - 1, 1))),
    why_it_matters: item.relevance ?? "Matches your search criteria",
    risks: "",
    citations: []
  }));

  await directus.createItems(items);

  return {
    run_key: runKey,
    imported_count: items.length
  };
});
