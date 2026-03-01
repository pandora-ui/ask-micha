import type { JSONSchemaType } from "ajv";

export type GoalPriority = "high" | "medium" | "low";

export interface GoalSpec {
  name: string;
  version: number;
  focus_topics: string[];
  excluded_topics: string[];
  target_audience: string;
  lookback_days: number;
  max_items: number;
  scoring_weights: {
    recency: number;
    relevance: number;
    source_trust: number;
  };
  must_include_keywords: string[];
  created_at: string;
}

export const goalSpecSchema: JSONSchemaType<GoalSpec> = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "version",
    "focus_topics",
    "excluded_topics",
    "target_audience",
    "lookback_days",
    "max_items",
    "scoring_weights",
    "must_include_keywords",
    "created_at"
  ],
  properties: {
    name: { type: "string", minLength: 3 },
    version: { type: "integer", minimum: 1 },
    focus_topics: {
      type: "array",
      minItems: 0,
      items: { type: "string", minLength: 1 }
    },
    excluded_topics: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    target_audience: { type: "string", minLength: 3 },
    lookback_days: { type: "integer", minimum: 1, maximum: 60 },
    max_items: { type: "integer", minimum: 1, maximum: 50 },
    scoring_weights: {
      type: "object",
      additionalProperties: false,
      required: ["recency", "relevance", "source_trust"],
      properties: {
        recency: { type: "number", minimum: 0, maximum: 1 },
        relevance: { type: "number", minimum: 0, maximum: 1 },
        source_trust: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    must_include_keywords: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    created_at: { type: "string", format: "date-time" }
  }
};
