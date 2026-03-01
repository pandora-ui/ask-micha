import OpenAI from "openai";
import type { NormalizedItem } from "@mvp/shared";

export interface OpenAiInsightsResult {
  executive_summary: string;
  item_insights: Array<{
    id: string;
    why_it_matters: string;
    risks: string;
  }>;
  audit: {
    model: string;
    prompt: string;
    parameters: {
      temperature: number;
    };
    response: string;
  };
}

export const generateInsights = async (args: {
  apiKey: string;
  model: string;
  items: NormalizedItem[];
}): Promise<OpenAiInsightsResult> => {
  const client = new OpenAI({ apiKey: args.apiKey });

  // Use simple numeric IDs so the model returns them reliably.
  // The original item IDs (long URLs) are mapped back after parsing.
  const indexToId = new Map(args.items.map((item, i) => [String(i + 1), item.id]));

  const prompt = [
    "You are producing concise business intelligence output.",
    "Return strict JSON with keys: executive_summary (string), item_insights (array of {id, why_it_matters, risks}).",
    "Each why_it_matters and risks must be max 25 words.",
    "Only use the numeric item ids provided.",
    `Items: ${JSON.stringify(
      args.items.map((item, i) => ({ id: String(i + 1), title: item.title, summary: item.summary, url: item.url }))
    )}`
  ].join("\n");

  const call = async (model: string) => {
    return client.chat.completions.create({
      model,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });
  };

  let usedModel = args.model;
  let response;
  try {
    response = await call(usedModel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("invalid model")) {
      throw error;
    }
    usedModel = "gpt-4.1-mini";
    response = await call(usedModel);
  }

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    executive_summary?: string;
    item_insights?: Array<{ id?: string; why_it_matters?: string; risks?: string }>;
  };

  return {
    executive_summary: parsed.executive_summary ?? "No summary generated.",
    item_insights: (parsed.item_insights ?? [])
      .filter((i) => i.id)
      .map((i) => ({
        id: indexToId.get(i.id ?? "") ?? i.id ?? "",
        why_it_matters: i.why_it_matters ?? "No explanation generated.",
        risks: i.risks ?? "No risks identified."
      })),
    audit: {
      model: usedModel,
      prompt,
      parameters: { temperature: 1 },
      response: raw
    }
  };
};
