import { getDirectusClient } from "../../utils/directus";

interface RunRecord {
  run_key: string;
}

interface RunItemRecord {
  title: string;
  url: string;
  score: number;
}

export default defineEventHandler(async () => {
  const directus = getDirectusClient();

  let latestRun: { data: RunRecord[] };
  try {
    latestRun = await directus.request<{ data: RunRecord[] }>(
      "/items/ai_runs?limit=1&sort=-run_key&fields=run_key"
    );
  } catch {
    return { run: null, items: [] };
  }

  const runKey = latestRun.data[0]?.run_key;
  if (!runKey) {
    return { run: null, items: [] };
  }

  const items = await directus.request<{ data: RunItemRecord[] }>(
    `/items/ai_run_items?filter[run_key][_eq]=${encodeURIComponent(runKey)}&limit=10&sort=-score&fields=title,url,score`
  );

  return {
    run: { run_key: runKey },
    items: items.data
  };
});
