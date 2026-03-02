import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

// ─── URL safety check (SSRF prevention) ──────────────────────────────────────

function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )
      return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal"))
      return false;
    if (
      hostname.startsWith("169.254.") ||
      hostname === "metadata.google.internal"
    )
      return false;
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface DiscoverRequest {
  goal_name?: string;
  focus_topics?: string[];
  must_include_keywords?: string[];
  target_audience?: string;
}

interface SuggestedSource {
  url: string;
  type: "rss" | "api";
  label: string;
  weight: number;
  reason: string;
}

interface ValidatedSource extends SuggestedSource {
  valid: boolean;
  feed_title?: string | null;
  item_count?: number;
  error?: string;
}

async function callOpenAiForSources(args: {
  apiKey: string;
  model: string;
  focusTopics: string[];
  mustIncludeKeywords: string[];
  targetAudience: string;
  goalName: string;
  existingUrls: Set<string>;
}): Promise<SuggestedSource[]> {
  const existingList =
    args.existingUrls.size > 0
      ? `\nAlready configured sources (do NOT suggest these URLs): ${[...args.existingUrls].join(", ")}`
      : "";

  const prompt = [
    "You are an expert at finding high-quality RSS feeds and news API endpoints for intelligence monitoring.",
    "Given the following search goal, suggest 5-10 relevant RSS feed URLs that would provide the best coverage.",
    "",
    `Goal name: ${args.goalName}`,
    `Focus topics: ${args.focusTopics.length > 0 ? args.focusTopics.join(", ") : "general / broad monitoring"}`,
    `Required keywords: ${args.mustIncludeKeywords.length > 0 ? args.mustIncludeKeywords.join(", ") : "none"}`,
    `Target audience: ${args.targetAudience}`,
    existingList,
    "",
    "Requirements:",
    "- Only suggest real, publicly accessible RSS/Atom feed URLs that are likely to work",
    "- Prefer well-known, reliable sources with regular updates",
    "- Include a mix of news sites, blogs, and specialized sources relevant to the topics",
    "- Each source should have a descriptive label and a brief reason why it's relevant",
    "- Assign a weight between 0.05 and 0.5 based on how relevant and trustworthy the source is for this goal",
    "- Do NOT suggest sources that are already in the existing list above",
    "- Focus on RSS feeds (type: rss). Only suggest API endpoints (type: api) if they return JSON with news items.",
    "",
    "Return strict JSON with key: sources (array of objects with fields: url, type, label, weight, reason).",
    'type must be either "rss" or "api".',
    'Example: { "sources": [{ "url": "https://example.com/feed.xml", "type": "rss", "label": "Example News", "weight": 0.15, "reason": "Covers topic X with daily updates" }] }',
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 1.0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message?.content ?? "{}";
  let parsed: {
    sources?: Array<{
      url?: string;
      type?: string;
      label?: string;
      weight?: number;
      reason?: string;
    }>;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  return (parsed.sources ?? [])
    .filter((s) => s.url && s.label)
    .map((s) => ({
      url: s.url!,
      type: s.type === "api" ? ("api" as const) : ("rss" as const),
      label: s.label!,
      weight: Math.min(0.5, Math.max(0.05, s.weight ?? 0.1)),
      reason: s.reason ?? "Relevant to your goal topics",
    }));
}

async function validateFeedUrl(url: string): Promise<{
  valid: boolean;
  title?: string | null;
  itemCount?: number;
  error?: string;
}> {
  if (!isUrlSafe(url)) {
    return { valid: false, error: "Blocked: private or internal URL" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Validator/1.0)" },
    });

    if (!response.ok) {
      clearTimeout(timer);
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    clearTimeout(timer);
    const isRss =
      text.includes("<rss") ||
      text.includes("<feed") ||
      text.includes("<rdf:RDF");

    if (!isRss) {
      return { valid: false, error: "Not an RSS/Atom feed" };
    }

    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/i);
    const title = titleMatch?.[1]?.trim() ?? null;
    const itemCount = (text.match(/<item[\s>]|<entry[\s>]/gi) ?? []).length;

    return { valid: true, title, itemCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("aborted") || msg.includes("abort")) {
      return { valid: false, error: "Timed out" };
    }
    return { valid: false, error: msg };
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = config.openAiApiKey;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: "OpenAI API key not configured",
    });
  }

  const body = (await readBody(event)) as DiscoverRequest;

  const focusTopics = body.focus_topics ?? [];
  const mustIncludeKeywords = body.must_include_keywords ?? [];
  const targetAudience = body.target_audience ?? "General";
  const goalName = body.goal_name ?? "Intelligence Watch";

  // Get existing source URLs to avoid duplicates
  const directus = getDirectusClient();
  const result = await directus.getLatestSourcePolicyWithVersion();
  const currentPolicy = result?.policy ?? defaultSourcePolicy();
  const existingUrls = new Set(currentPolicy.sources.map((s) => s.url));

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  // Call OpenAI for source suggestions
  const suggested = await callOpenAiForSources({
    apiKey,
    model,
    focusTopics,
    mustIncludeKeywords,
    targetAudience,
    goalName,
    existingUrls,
  });

  // Filter out any sources whose URL already exists or that target internal URLs
  const fresh = suggested.filter(
    (s) => !existingUrls.has(s.url) && isUrlSafe(s.url),
  );

  // Validate each suggested source in parallel
  const validated: ValidatedSource[] = await Promise.all(
    fresh.map(async (source): Promise<ValidatedSource> => {
      if (source.type === "api") {
        // Skip validation for API type — we trust OpenAI's suggestion
        return { ...source, valid: true };
      }
      const result = await validateFeedUrl(source.url);
      return {
        ...source,
        valid: result.valid,
        feed_title: result.title,
        item_count: result.itemCount,
        error: result.error,
      };
    }),
  );

  return {
    suggestions: validated,
    existing_count: currentPolicy.sources.length,
  };
});
