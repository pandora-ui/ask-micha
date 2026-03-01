import type { JSONSchemaType } from "ajv";

export interface SourcePolicy {
  name: string;
  version: number;
  sources: Array<{
    id: string;
    type: "rss" | "api";
    enabled: boolean;
    url: string;
    weight: number;
  }>;
  dedupe: {
    by_url: boolean;
    by_title: boolean;
  };
  created_at: string;
}

export const sourcePolicySchema: JSONSchemaType<SourcePolicy> = {
  type: "object",
  additionalProperties: false,
  required: ["name", "version", "sources", "dedupe", "created_at"],
  properties: {
    name: { type: "string", minLength: 3 },
    version: { type: "integer", minimum: 1 },
    sources: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "enabled", "url", "weight"],
        properties: {
          id: { type: "string", minLength: 2 },
          type: { type: "string", enum: ["rss", "api"] },
          enabled: { type: "boolean" },
          url: { type: "string", format: "uri" },
          weight: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    dedupe: {
      type: "object",
      additionalProperties: false,
      required: ["by_url", "by_title"],
      properties: {
        by_url: { type: "boolean" },
        by_title: { type: "boolean" }
      }
    },
    created_at: { type: "string", format: "date-time" }
  }
};
