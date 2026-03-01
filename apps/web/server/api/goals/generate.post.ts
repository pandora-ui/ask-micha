import { validateGoalSpec } from "@mvp/schemas";
import { defaultGoalSpec } from "@mvp/shared";

interface DiscoveryAnswers {
  goal_name: string;
  focus_topics: string[];
  excluded_topics: string[];
  target_audience: string;
  must_include_keywords: string[];
  lookback_days: number;
  max_items: number;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { answers: DiscoveryAnswers; version?: number };
  const base = defaultGoalSpec();

  const goalSpec = validateGoalSpec({
    ...base,
    name: body.answers.goal_name,
    version: body.version ?? 1,
    focus_topics: body.answers.focus_topics,
    excluded_topics: body.answers.excluded_topics,
    target_audience: body.answers.target_audience,
    must_include_keywords: body.answers.must_include_keywords,
    lookback_days: Number(body.answers.lookback_days),
    max_items: Number(body.answers.max_items),
    created_at: new Date().toISOString()
  });

  return { goalSpec };
});
