import type { GoalSpec, SourcePolicy } from "@mvp/schemas";
import type { NormalizedItem } from "./types";

const normalizeText = (value: string): string => value.trim().toLowerCase();

const scoreRecency = (publishedAt: string, lookbackDays: number, referenceTimeMs: number): number => {
  const published = new Date(publishedAt).getTime();
  const ageDays = Math.max(0, (referenceTimeMs - published) / (1000 * 60 * 60 * 24));
  return Math.max(0, 1 - ageDays / lookbackDays);
};

const scoreRelevance = (item: NormalizedItem, goalSpec: GoalSpec): number => {
  const haystack = normalizeText(`${item.title} ${item.summary}`);
  const targets = [
    ...goalSpec.focus_topics.map(normalizeText),
    ...goalSpec.must_include_keywords.map(normalizeText)
  ];
  if (targets.length === 0) {
    return 1.0;
  }
  const matches = targets.filter((kw) => haystack.includes(kw)).length;
  return matches / targets.length;
};

const scoreSourceTrust = (item: NormalizedItem, sourcePolicy: SourcePolicy): number => {
  const source = sourcePolicy.sources.find((s) => s.id === item.source_id);
  return source?.weight ?? 0;
};

export const scoreItemDeterministic = (
  item: NormalizedItem,
  goalSpec: GoalSpec,
  sourcePolicy: SourcePolicy,
  referenceTimeMs: number = new Date(item.published_at).getTime()
): number => {
  const recency = scoreRecency(item.published_at, goalSpec.lookback_days, referenceTimeMs);
  const relevance = scoreRelevance(item, goalSpec);
  const sourceTrust = scoreSourceTrust(item, sourcePolicy);

  const weighted =
    recency * goalSpec.scoring_weights.recency +
    relevance * goalSpec.scoring_weights.relevance +
    sourceTrust * goalSpec.scoring_weights.source_trust;

  return Number(weighted.toFixed(6));
};

export const rankItems = (
  items: NormalizedItem[],
  goalSpec: GoalSpec,
  sourcePolicy: SourcePolicy
): NormalizedItem[] => {
  const referenceTimeMs = items.reduce((max, item) => {
    const ts = new Date(item.published_at).getTime();
    return Number.isFinite(ts) ? Math.max(max, ts) : max;
  }, 0);

  return [...items]
    .map((item) => ({
      ...item,
      score: scoreItemDeterministic(item, goalSpec, sourcePolicy, referenceTimeMs)
    }))
    .sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) {
        return (b.score ?? 0) - (a.score ?? 0);
      }
      return a.title.localeCompare(b.title);
    });
};
