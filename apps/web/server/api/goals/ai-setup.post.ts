import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

/**
 * POST /api/goals/ai-setup
 *
 * Takes a plain-text description of what the user wants to find or monitor.
 * Uses OpenAI to generate goal parameters AND decides the best result mode:
 *   - "sources": for ongoing monitoring — returns RSS feed URLs to subscribe to
 *   - "content": for immediate results — returns actual content items directly
 *
 * Returns: { goal, result_mode, sources?, content_items?, existing_source_count }
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

interface ContentItem {
  title: string;
  url: string;
  description: string;
  source: string;
  relevance: string;
}

// ─── URL safety check (SSRF prevention) ──────────────────────────────────────

function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);

    // Only allow http(s)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost / loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )
      return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal"))
      return false;

    // Block link-local / metadata
    if (
      hostname.startsWith("169.254.") ||
      hostname === "metadata.google.internal"
    )
      return false;

    // Block private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (a === 10) return false; // 10.x.x.x
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16-31.x.x
      if (a === 192 && b === 168) return false; // 192.168.x.x
      if (a === 0) return false; // 0.x.x.x
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

// ─── Main handler ────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = config.openAiApiKey;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: "OpenAI API key not configured",
    });
  }

  const body = (await readBody(event)) as AiSetupRequest;
  const description = (body.description ?? "").trim();

  if (!description || description.length < 5) {
    throw createError({
      statusCode: 400,
      message: "Please provide a description of at least 5 characters",
    });
  }

  // Get existing source URLs to avoid duplicates
  const directus = getDirectusClient();
  const policyResult = await directus.getLatestSourcePolicyWithVersion();
  const currentPolicy = policyResult?.policy ?? defaultSourcePolicy();
  const existingUrls = new Set(currentPolicy.sources.map((s) => s.url));

  const existingUrlsList = [...existingUrls];

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  // ─── JSON-based prompt structure ──────────────────────────────────────────
  // Both the system instruction and user input use structured JSON for
  // scalability, verifiability, and consistent parsing.

  const systemPrompt = "Respond with a single JSON object.\n\n" + JSON.stringify({
    role: "You are an expert intelligence analyst and content curator.",
    task: "Analyze the user's description and generate a complete goal configuration with results.",
    instructions: {
      step_1_decide_mode: {
        description: "Decide the best result_mode based on the user's intent.",
        rules: [
          "Use 'sources' ONLY when the user explicitly wants ONGOING, RECURRING monitoring over time (keywords: 'track', 'monitor', 'follow', 'subscribe', 'watch regularly', 'keep me updated').",
          "Use 'content' for EVERYTHING ELSE — including searches, lookups, finding items, research, lists, recommendations, discoveries, analyses, comparisons.",
          "When in doubt, default to 'content'. It is the more useful mode for most queries.",
          "The user's description determines the mode — not the topic. A patent search, a movie search, a restaurant search, a tool comparison — all use 'content' mode."
        ]
      },
      step_2_generate_goal: {
        description: "Create a structured goal configuration from the user's description.",
        fields: {
          name: "short descriptive name for the goal (3-50 chars), derived from the user's description",
          focus_topics: "array of 3-8 relevant topic keywords, lowercase",
          excluded_topics: "array of 0-5 topics to exclude, lowercase",
          must_include_keywords: "array of 0-5 critical keywords, lowercase",
          target_audience: "one of: General, Executive team, Product leadership, Engineering management, Marketing leadership, Research team",
          lookback_days: "number 1-60",
          max_items: "number 5-50"
        }
      },
      step_3_generate_results: {
        sources_mode: {
          description: "Return 5-10 real, publicly accessible RSS/Atom feed URLs.",
          rules: [
            "Only suggest real, working RSS/Atom feed URLs",
            "Prefer well-known, reliable sources with regular updates",
            "type must be 'rss' or 'api'",
            "Do NOT suggest URLs from the excluded_urls list"
          ]
        },
        content_mode: {
          description: "Return 5-20 actual, real content items that DIRECTLY answer the user's query.",
          rules: [
            "Items must be specific and relevant to exactly what the user asked for",
            "Use real, working URLs",
            "Be current and factual",
            "Each item should directly match the user's described intent",
            "Do NOT return generic websites or news pages — return actual results/items the user is looking for"
          ]
        }
      }
    },
    output_schema: {
      result_mode: "'sources' or 'content'",
      goal: {
        name: "string",
        focus_topics: "string[]",
        excluded_topics: "string[]",
        must_include_keywords: "string[]",
        target_audience: "string",
        lookback_days: "number",
        max_items: "number"
      },
      sources: "Array<{url, type, label, weight, reason}> — only if result_mode='sources'",
      content_items: "Array<{title, url, description, source, relevance}> — only if result_mode='content'"
    }
  });

  const userInput = JSON.stringify({
    user_description: description,
    excluded_urls: existingUrlsList.length > 0 ? existingUrlsList : undefined
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw createError({
      statusCode: 502,
      message: `OpenAI API error ${response.status}: ${errorBody}`,
    });
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices[0]?.message?.content ?? "{}";
  let parsed: {
    result_mode?: string;
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
    content_items?: Array<{
      title?: string;
      url?: string;
      description?: string;
      source?: string;
      relevance?: string;
    }>;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw createError({
      statusCode: 502,
      message: "OpenAI returned invalid JSON",
    });
  }

  // Determine result mode
  const resultMode: "sources" | "content" =
    parsed.result_mode === "content" ? "content" : "sources";

  // Build goal from AI response
  const aiGoal = parsed.goal ?? {};
  const goal: GeneratedGoal = {
    name: (aiGoal.name ?? "Intelligence Watch").slice(0, 50),
    focus_topics: (aiGoal.focus_topics ?? [])
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 8),
    excluded_topics: (aiGoal.excluded_topics ?? [])
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 5),
    must_include_keywords: (aiGoal.must_include_keywords ?? [])
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 5),
    target_audience: aiGoal.target_audience ?? "General",
    lookback_days: Math.min(60, Math.max(1, aiGoal.lookback_days ?? 7)),
    max_items: Math.min(50, Math.max(5, aiGoal.max_items ?? 20)),
  };

  if (resultMode === "content") {
    // Content mode: return curated content items directly
    const contentItems: ContentItem[] = (parsed.content_items ?? [])
      .filter((item) => item.title && item.url)
      .map((item) => ({
        title: item.title!,
        url: item.url!,
        description: item.description ?? "",
        source: item.source ?? "",
        relevance: item.relevance ?? "Matches your search criteria",
      }))
      .slice(0, 30);

    return {
      goal,
      result_mode: "content" as const,
      content_items: contentItems,
      sources: [],
      existing_source_count: currentPolicy.sources.length,
    };
  }

  // Sources mode: validate RSS feeds
  const suggestedSources: SuggestedSource[] = (parsed.sources ?? [])
    .filter((s) => s.url && s.label)
    .filter((s) => isUrlSafe(s.url!))
    .filter((s) => !existingUrls.has(s.url!))
    .map((s) => ({
      url: s.url!,
      type: s.type === "api" ? ("api" as const) : ("rss" as const),
      label: s.label!,
      weight: Math.min(0.5, Math.max(0.05, s.weight ?? 0.1)),
      reason: s.reason ?? "Relevant to your goal topics",
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
        error: result.error,
      };
    }),
  );

  return {
    goal,
    result_mode: "sources" as const,
    sources: validatedSources,
    content_items: [],
    existing_source_count: currentPolicy.sources.length,
  };
});
