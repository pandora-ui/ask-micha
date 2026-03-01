import type { GoalSpec, SourcePolicy } from "@mvp/schemas";

export interface NormalizedItem {
  id: string;
  source_id: string;
  source_type: "rss" | "api";
  title: string;
  url: string;
  summary: string;
  published_at: string;
  citation_urls: string[];
  score?: number;
  why_it_matters?: string;
  risks?: string;
}

export interface RunContext {
  run_key: string;
  mode: "pilot" | "manual" | "scheduled";
  started_at: string;
  goal_spec: GoalSpec;
  source_policy: SourcePolicy;
}
