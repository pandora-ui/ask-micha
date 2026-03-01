import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

/**
 * POST /api/goals/ai-setup
 *
 * Takes a plain-text description of what the user wants to monitor,
 * uses OpenAI to generate all goal parameters (name, topics, keywords,
 * exclusions, audience, etc.) AND discover relevant RSS sources in one call.
 *
 * Returns: { goal: GeneratedGoal, sources: ValidatedSource[] }
 */

interface AiSetupRequest {
  description: string;
}

interface GeneratedGoal {
  name: string;
  focus_topics: string[];
  excluded_topics: string[];
  must_include_keywords: string[];
  target_audience: string;
  lookback_days: number;
  max_items: number;
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

// ─── URL safety check (SSRF prevention) ──────────────────────────────────────

function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);

    // Only allow http(s)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost / loopback
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;

    // Block link-local / metadata
    if (hostname.startsWith("169.254.") || hostname === "metadata.google.internal") return false;

    // Block private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (a === 10) return false;                              // 10.x.x.x
      if (a === 172 && b >= 16 && b <= 31) return false;      // 172.16-31.x.x
      if (a === 192 && b === 168) return false;                // 192.168.x.x
      if (a === 0) return false;                               // 0.x.x.x
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Feed validation ─────────────────────────────────────────────────────────

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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Validator/1.0)" }
    });

    if (!response.ok) {
      clearTimeout(timer);
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    clearTimeout(timer);

    const isRss = text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF");

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

// ─── Main handler ────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = config.openAiApiKey;

  if (!apiKey) {
    throw createError({ statusCode: 500, message: "OpenAI API key not configured" });
  }

  const body = (await readBody(event)) as AiSetupRequest;
  const description = (body.description ?? "").trim();

  if (!description || description.length < 5) {
    throw createError({ statusCode: 400, message: "Please provide a description of at least 5 characters" });
  }

  // Get existing source URLs to avoid duplicates
  const directus = getDirectusClient();
  const policyResult = await directus.getLatestSourcePolicyWithVersion();
  const currentPolicy = policyResult?.policy ?? defaultSourcePolicy();
  const existingUrls = new Set(currentPolicy.sources.map((s) => s.url));

  const existingList = existingUrls.size > 0
    ? `\nAlready configured sources (do NOT suggest these URLs): ${[...existingUrls].join(", ")}`
    : "";

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const prompt = [
    "You are an expert intelligence analyst and RSS feed curator.",
    "A user wants to set up an automated intelligence watch. They described their goal in plain language.",
    "Your job is to:",
    "1. Create a structured goal configuration from their description",
    "2. Find 5-10 relevant, real RSS feed URLs that would best serve this goal",
    "",
    `User's description: "${description}"`,
    existingList,
    "",
    "Return strict JSON with two keys:",
    "",
    "\"goal\": {",
    "  \"name\": \"short descriptive name for the goal (3-50 chars)\",",
    "  \"focus_topics\": [\"array of 3-8 relevant topic keywords, lowercase\"],",
    "  \"excluded_topics\": [\"array of 0-5 topics to exclude, lowercase\"],",
    "  \"must_include_keywords\": [\"array of 0-5 critical keywords that items should contain, lowercase\"],",
    "  \"target_audience\": \"one of: General, Executive team, Product leadership, Engineering management, Marketing leadership, Research team\",",
    "  \"lookback_days\": number (1-60, how many days back to look),",
    "  \"max_items\": number (5-50, maximum items per run)",
    "}",
    "",
    "\"sources\": [",
    "  {",
    "    \"url\": \"real publicly accessible RSS/Atom feed URL\",",
    "    \"type\": \"rss\",",
    "    \"label\": \"descriptive label for the source\",",
    "    \"weight\": number (0.05-0.5, relevance/trust weight),",
    "    \"reason\": \"brief reason why this source is relevant\"",
    "  }",
    "]",
    "",
    "Requirements:",
    "- Only suggest REAL, publicly accessible RSS/Atom feed URLs that are likely to work right now",
    "- Prefer well-known, reliable sources (major news sites, popular blogs, official feeds)",
    "- Include a diverse mix of sources covering different angles of the topic",
    "- type must be \"rss\" or \"api\"",
    "- Do NOT suggest sources already in the existing list above",
    "- Infer the best goal parameters from the user's natural language description",
    "- If the description is vague, make reasonable assumptions and be broad in topic coverage"
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw createError({ statusCode: 502, message: `OpenAI API error ${response.status}: ${errorBody}` });
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message?.content ?? "{}";
  let parsed: {
    goal?: {
      name?: string;
      focus_topics?: string[];
      excluded_topics?: string[];
      must_include_keywords?: string[];
      target_audience?: string;
      lookback_days?: number;
      max_items?: number;
    };
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
    throw createError({ statusCode: 502, message: "OpenAI returned invalid JSON" });
  }

  // Build goal from AI response
  const aiGoal = parsed.goal ?? {};
  const goal: GeneratedGoal = {
    name: (aiGoal.name ?? "Intelligence Watch").slice(0, 50),
    focus_topics: (aiGoal.focus_topics ?? []).map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8),
    excluded_topics: (aiGoal.excluded_topics ?? []).map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5),
    must_include_keywords: (aiGoal.must_include_keywords ?? []).map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5),
    target_audience: aiGoal.target_audience ?? "General",
    lookback_days: Math.min(60, Math.max(1, aiGoal.lookback_days ?? 7)),
    max_items: Math.min(50, Math.max(5, aiGoal.max_items ?? 20))
  };

  // Process sources
  const suggestedSources: SuggestedSource[] = (parsed.sources ?? [])
    .filter((s) => s.url && s.label)
    .filter((s) => isUrlSafe(s.url!))
    .filter((s) => !existingUrls.has(s.url!))
    .map((s) => ({
      url: s.url!,
      type: s.type === "api" ? "api" as const : "rss" as const,
      label: s.label!,
      weight: Math.min(0.5, Math.max(0.05, s.weight ?? 0.1)),
      reason: s.reason ?? "Relevant to your goal topics"
    }));

  // Validate each source in parallel
  const validatedSources: ValidatedSource[] = await Promise.all(
    suggestedSources.map(async (source): Promise<ValidatedSource> => {
      if (source.type === "api") {
        return { ...source, valid: true };
      }
      const result = await validateFeedUrl(source.url);
      return {
        ...source,
        valid: result.valid,
        feed_title: result.title,
        item_count: result.itemCount,
        error: result.error
      };
    })
  );

  return {
    goal,
    sources: validatedSources,
    existing_source_count: currentPolicy.sources.length
  };
});
