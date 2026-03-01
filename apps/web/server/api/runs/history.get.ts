import { getDirectusClient } from "../../utils/directus";

interface RunRecord {
  run_key: string;
  mode: string;
  status: string;
  report_json?: {
    generated_at?: string;
    top_count?: number;
    total_candidates?: number;
  };
}

export default defineEventHandler(async () => {
  const directus = getDirectusClient();

  try {
    const response = await directus.request<{ data: RunRecord[] }>(
      "/items/ai_runs?limit=20&sort=-run_key&fields=run_key,mode,status,report_json"
    );

    return {
      runs: response.data.map((run) => ({
        run_key: run.run_key,
        mode: run.mode,
        status: run.status,
        generated_at: run.report_json?.generated_at ?? null,
        top_count: run.report_json?.top_count ?? null,
        total_candidates: run.report_json?.total_candidates ?? null
      }))
    };
  } catch {
    return { runs: [] };
  }
});
