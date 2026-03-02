import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

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

const DEFAULT_MODEL = "gpt-4.1-mini";
const isPatentIntent = (description: string): boolean =>
  /patent|patente|dpma|epo|espacenet|depatis|wipo|uspto|patentscope/i.test(description);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (hostname.startsWith("169.254.") || hostname === "metadata.google.internal") return false;

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

async function validateFeedUrl(url: string): Promise<{ valid: boolean; title?: string | null; itemCount?: number; error?: string }> {
  if (!isUrlSafe(url)) {
    return { valid: false, error: "Blocked: private or internal URL" };
  }

  try {
    let text = "";
    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Validator/1.0)" }
      });
      clearTimeout(timer);

      lastStatus = response.status;
      if (response.ok) {
        text = await response.text();
        break;
      }

      if (attempt === 0 && [429, 502, 503, 504].includes(response.status)) {
        await sleep(500);
        continue;
      }
      return { valid: false, error: `HTTP ${response.status}` };
    }

    if (!text) {
      return { valid: false, error: `HTTP ${lastStatus || 500}` };
    }

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
    return { valid: false, error: msg.includes("abort") ? "Timed out" : msg };
  }
}

const looksLikeSupportedApiPayload = (payload: unknown): { ok: boolean; itemCount?: number; error?: string } => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "API payload is not JSON object/array" };
  }

  const asRecord = payload as Record<string, unknown>;

  // Existing connector support (HN style)
  if (Array.isArray(asRecord.hits)) {
    return { ok: true, itemCount: asRecord.hits.length };
  }

  // PatentView style
  if (Array.isArray(asRecord.patents)) {
    return { ok: true, itemCount: asRecord.patents.length };
  }

  // Generic array payload
  if (Array.isArray(payload)) {
    return { ok: true, itemCount: payload.length };
  }

  // Generic wrapped items
  if (Array.isArray(asRecord.items)) {
    return { ok: true, itemCount: asRecord.items.length };
  }

  return { ok: false, error: "Unsupported API JSON structure" };
};

async function validateApiUrl(url: string): Promise<{ valid: boolean; itemCount?: number; error?: string }> {
  if (!isUrlSafe(url)) {
    return { valid: false, error: "Blocked: private or internal URL" };
  }

  try {
    let data: unknown = null;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; API-Validator/1.0)" }
      });
      clearTimeout(timer);

      lastStatus = response.status;
      if (response.ok) {
        data = (await response.json()) as unknown;
        break;
      }

      if (attempt === 0 && [429, 502, 503, 504].includes(response.status)) {
        await sleep(500);
        continue;
      }
      return { valid: false, error: `HTTP ${response.status}` };
    }

    if (data === null) {
      return { valid: false, error: `HTTP ${lastStatus || 500}` };
    }

    const checked = looksLikeSupportedApiPayload(data);
    if (!checked.ok) {
      return { valid: false, error: checked.error };
    }

    return { valid: true, itemCount: checked.itemCount ?? 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: msg.includes("abort") ? "Timed out" : msg };
  }
}

const toGoogleNewsRss = (q: string): string => {
  const params = new URLSearchParams({
    q,
    hl: "en-US",
    gl: "US",
    ceid: "US:en"
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
};

const patentFallbackSources = (description: string): SuggestedSource[] => {
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !["the", "and", "for", "with", "from", "that", "this", "patent", "patents"].includes(w))
    .slice(0, 4);
  const term = words.join(" ") || "technology";
  return [
    {
      url: toGoogleNewsRss(`"${term}" patent (filing OR grant)`),
      type: "rss",
      label: "Patent News: Global",
      weight: 0.3,
      reason: "Recent patent publications and grant news"
    },
    {
      url: toGoogleNewsRss(`"${term}" patent site:uspto.gov`),
      type: "rss",
      label: "Patent News: USPTO",
      weight: 0.25,
      reason: "Patent updates linked to USPTO sources"
    },
    {
      url: toGoogleNewsRss(`"${term}" patent site:wipo.int`),
      type: "rss",
      label: "Patent News: WIPO",
      weight: 0.2,
      reason: "Patent and IP updates from WIPO domain coverage"
    },
    {
      url: toGoogleNewsRss(`"${term}" patent site:epo.org`),
      type: "rss",
      label: "Patent News: EPO",
      weight: 0.15,
      reason: "European patent updates from EPO domain coverage"
    },
    {
      url: toGoogleNewsRss(`"${term}" patent site:patents.google.com`),
      type: "rss",
      label: "Patent News: Google Patents Coverage",
      weight: 0.1,
      reason: "Coverage and references that include Google Patents links"
    }
  ];
};

const defaultFallbackSources = (): SuggestedSource[] => [
  {
    url: "https://hnrss.org/frontpage",
    type: "rss",
    label: "Hacker News",
    weight: 0.2,
    reason: "General fallback source with frequent updates"
  }
];

const fallbackSourcesForDescription = (description: string): SuggestedSource[] => {
  if (isPatentIntent(description)) {
    return patentFallbackSources(description);
  }
  return defaultFallbackSources();
};

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

  const directus = getDirectusClient();
  const policyResult = await directus.getLatestSourcePolicyWithVersion();
  const currentPolicy = policyResult?.policy ?? defaultSourcePolicy();
  const existingUrls = new Set(currentPolicy.sources.map((s) => s.url));

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const systemPrompt = [
    "Return strict JSON only.",
    "Task: derive a run-ready monitoring goal and source plan from user intent.",
    "You MUST return only sources that can be directly fetched by a backend run.",
    "Prefer concrete RSS feeds and JSON APIs.",
    "Do NOT return tutorials, explanation pages, or placeholder links.",
    "Output schema:",
    JSON.stringify({
      goal: {
        name: "string",
        focus_topics: ["string"],
        excluded_topics: ["string"],
        must_include_keywords: ["string"],
        target_audience: "string",
        lookback_days: 7,
        max_items: 20
      },
      sources: [
        {
          url: "https://...",
          type: "rss|api",
          label: "string",
          weight: 0.1,
          reason: "string"
        }
      ]
    })
  ].join("\n");

  const userPrompt = JSON.stringify({
    description,
    excluded_urls: [...existingUrls],
    constraints: {
      min_sources: 5,
      max_sources: 12,
      allowed_types: ["rss", "api"]
    }
  });

  const callModel = async (targetModel: string) => {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
  };

  let response = await callModel(model);
  if (!response.ok && model !== DEFAULT_MODEL) {
    response = await callModel(DEFAULT_MODEL);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw createError({
      statusCode: 502,
      message: `OpenAI API error ${response.status}: ${errorBody}`
    });
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
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

  const normalizedSources: SuggestedSource[] = (parsed.sources ?? [])
    .filter((s) => s.url && s.label)
    .filter((s) => isUrlSafe(s.url!))
    .filter((s) => !existingUrls.has(s.url!))
    .map((s) => ({
      url: s.url!,
      type: s.type === "api" ? "api" : "rss",
      label: s.label!,
      weight: Math.min(0.5, Math.max(0.05, s.weight ?? 0.1)),
      reason: s.reason ?? "Relevant to your goal topics"
    }));

  const validateSources = async (sources: SuggestedSource[]): Promise<ValidatedSource[]> => {
    return Promise.all(
      sources.map(async (source): Promise<ValidatedSource> => {
      if (source.type === "api") {
        const result = await validateApiUrl(source.url);
        return {
          ...source,
          valid: result.valid,
          item_count: result.itemCount,
          error: result.error
        };
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
  };

  const primaryCandidates = isPatentIntent(description)
    ? patentFallbackSources(description).filter((source) => !existingUrls.has(source.url))
    : (normalizedSources.length > 0 ? normalizedSources : fallbackSourcesForDescription(description));
  let validatedSources = await validateSources(primaryCandidates);
  let validSources = validatedSources.filter((s) => s.valid);
  let fallbackUsed = false;

  if (validSources.length === 0) {
    const fallbackCandidates = fallbackSourcesForDescription(description).filter(
      (source) => !primaryCandidates.some((existing) => existing.url === source.url)
    );
    if (fallbackCandidates.length > 0) {
      const fallbackValidated = await validateSources(fallbackCandidates);
      const fallbackValid = fallbackValidated.filter((s) => s.valid);
      if (fallbackValid.length > 0) {
        validatedSources = fallbackValidated;
        validSources = fallbackValid;
        fallbackUsed = true;
      }
    }
  }

  return {
    goal,
    result_mode: "sources" as const,
    sources: validatedSources,
    content_items: [],
    auto_fallback_used: fallbackUsed,
    validation_summary: {
      requested: primaryCandidates.length,
      valid: validSources.length,
      invalid: validatedSources.length - validSources.length
    },
    existing_source_count: currentPolicy.sources.length
  };
});
