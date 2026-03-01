import { describe, expect, it } from "vitest";
import { validateGoalSpec, validateSourcePolicy } from "../src";

describe("schema validation", () => {
  it("accepts valid GoalSpec", () => {
    const spec = validateGoalSpec({
      name: "AI Strategy",
      version: 1,
      focus_topics: ["AI", "product"],
      excluded_topics: ["gaming"],
      target_audience: "Leadership",
      lookback_days: 7,
      max_items: 10,
      scoring_weights: { recency: 0.4, relevance: 0.4, source_trust: 0.2 },
      must_include_keywords: ["AI"],
      created_at: new Date().toISOString()
    });

    expect(spec.name).toBe("AI Strategy");
  });

  it("rejects invalid GoalSpec", () => {
    expect(() =>
      validateGoalSpec({
        name: "x",
        version: 0,
        focus_topics: [],
        excluded_topics: [],
        target_audience: "x",
        lookback_days: 100,
        max_items: 0,
        scoring_weights: { recency: 2, relevance: 0.2, source_trust: 0.2 },
        must_include_keywords: [],
        created_at: "bad"
      })
    ).toThrow("Invalid GoalSpec");
  });

  it("accepts valid SourcePolicy", () => {
    const policy = validateSourcePolicy({
      name: "Default Source Policy",
      version: 1,
      sources: [
        {
          id: "hn_rss",
          type: "rss",
          enabled: true,
          url: "https://hnrss.org/frontpage",
          weight: 0.6
        },
        {
          id: "hn_api",
          type: "api",
          enabled: true,
          url: "https://hn.algolia.com/api/v1/search_by_date?tags=story",
          weight: 0.4
        }
      ],
      dedupe: { by_url: true, by_title: true },
      created_at: new Date().toISOString()
    });

    expect(policy.sources).toHaveLength(2);
  });

  it("rejects SourcePolicy with one source", () => {
    expect(() =>
      validateSourcePolicy({
        name: "Bad Policy",
        version: 1,
        sources: [
          {
            id: "only",
            type: "rss",
            enabled: true,
            url: "https://example.com/feed",
            weight: 1
          }
        ],
        dedupe: { by_url: true, by_title: true },
        created_at: new Date().toISOString()
      })
    ).toThrow("Invalid SourcePolicy");
  });
});
