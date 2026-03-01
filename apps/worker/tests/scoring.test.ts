import { describe, expect, it } from "vitest";
import { scoreItemDeterministic } from "@mvp/shared";
import { defaultGoalSpec, defaultSourcePolicy } from "@mvp/shared";

describe("deterministic scoring", () => {
  it("returns same score for same input", () => {
    const goal = defaultGoalSpec();
    const policy = defaultSourcePolicy();

    const item = {
      id: "a",
      source_id: "hn_rss",
      source_type: "rss" as const,
      title: "AI agents for product teams",
      url: "https://example.com/ai",
      summary: "A deep dive into AI workflow automation.",
      published_at: new Date().toISOString(),
      citation_urls: ["https://example.com/ai"]
    };

    const one = scoreItemDeterministic(item, goal, policy);
    const two = scoreItemDeterministic(item, goal, policy);

    expect(one).toBe(two);
  });
});
