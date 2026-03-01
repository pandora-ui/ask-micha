import "dotenv/config";
import process from "node:process";

const DIRECTUS_URL = (
  process.env.DIRECTUS_URL ?? "http://localhost:8055"
).replace(/\/$/, "");
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

if (!TOKEN) {
  console.error("Missing DIRECTUS_ADMIN_TOKEN in environment (.env).");
  process.exit(1);
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok)
    throw new Error(`Directus API ${path} failed: ${res.status} ${text}`);
  return json;
}

async function main() {
  // Seed default project — schedule disabled by default, user enables via UI
  const existingProject = await adminFetch("/items/ai_projects?limit=1&fields=id", { method: "GET" });
  if ((existingProject?.data ?? []).length === 0) {
    try {
      const created = await adminFetch(`/items/ai_projects`, {
        method: "POST",
        body: JSON.stringify({
          name: "default",
          timezone: "Europe/Berlin",
          schedule_cron: "0 9 * * 1",
          enabled: false,
        }),
      });
      console.log("[seed] created project:", created?.data?.id ?? created);
    } catch (e) {
      console.log(
        "[seed] could not create project (fields may not exist yet):",
        (e as Error).message,
      );
    }
  } else {
    console.log("[seed] project already exists, skipping.");
  }

  // 6 general sources enabled by default; AI-specific ones disabled (user can enable via Sources page)
  const defaultPolicy = {
    name: "Default Source Policy",
    version: 1,
    sources: [
      { id: "hn_rss",         type: "rss", enabled: true,  url: "https://hnrss.org/frontpage",                                    weight: 0.2  },
      { id: "hn_api",         type: "api", enabled: true,  url: "https://hn.algolia.com/api/v1/search_by_date?tags=story",        weight: 0.15 },
      { id: "lobsters_rss",   type: "rss", enabled: true,  url: "https://lobste.rs/rss",                                          weight: 0.1  },
      { id: "github_blog",    type: "rss", enabled: true,  url: "https://github.blog/feed/",                                      weight: 0.1  },
      { id: "a16z_blog",      type: "rss", enabled: true,  url: "https://a16z.com/feed/",                                         weight: 0.1  },
      { id: "product_hunt",   type: "rss", enabled: true,  url: "https://www.producthunt.com/feed",                               weight: 0.07 },
      { id: "arxiv_cs_ai",    type: "rss", enabled: false, url: "https://export.arxiv.org/rss/cs.AI",                             weight: 0.15 },
      { id: "techcrunch_ai",  type: "rss", enabled: false, url: "https://techcrunch.com/tag/artificial-intelligence/feed/",       weight: 0.12 },
      { id: "verge_ai",       type: "rss", enabled: false, url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 0.1 },
      { id: "ieee_ai",        type: "rss", enabled: false, url: "https://spectrum.ieee.org/rss/topic/artificial-intelligence",    weight: 0.08 },
      { id: "openai_blog",    type: "rss", enabled: false, url: "https://openai.com/blog/rss.xml",                                weight: 0.15 },
      { id: "anthropic_blog", type: "rss", enabled: false, url: "https://www.anthropic.com/blog/rss.xml",                         weight: 0.15 },
      { id: "deepmind_blog",  type: "rss", enabled: false, url: "https://deepmind.google/discover/blog/rss.xml",                  weight: 0.12 },
      { id: "venturebeat_ai", type: "rss", enabled: false, url: "https://venturebeat.com/category/ai/feed/",                      weight: 0.1  },
      { id: "mit_ai_news",    type: "rss", enabled: false, url: "https://news.mit.edu/topic/artificial-intelligence2/rss.xml",    weight: 0.1  },
      { id: "arxiv_cs_lg",    type: "rss", enabled: false, url: "https://export.arxiv.org/rss/cs.LG",                             weight: 0.1  },
      { id: "arxiv_cs_cl",    type: "rss", enabled: false, url: "https://export.arxiv.org/rss/cs.CL",                             weight: 0.08 },
      { id: "reddit_ml",      type: "rss", enabled: false, url: "https://www.reddit.com/r/MachineLearning/.rss",                  weight: 0.08 },
      { id: "google_ai_blog", type: "rss", enabled: false, url: "https://blog.google/technology/ai/rss/",                         weight: 0.15 },
      { id: "microsoft_ai_blog", type: "rss", enabled: false, url: "https://blogs.microsoft.com/ai/feed/",                       weight: 0.12 },
      { id: "huggingface_blog",  type: "rss", enabled: false, url: "https://huggingface.co/blog/rss.xml",                        weight: 0.12 },
      { id: "mit_tech_review_ai",type: "rss", enabled: false, url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", weight: 0.12 },
      { id: "ars_technica_ai",   type: "rss", enabled: false, url: "https://arstechnica.com/ai/feed/",                           weight: 0.1  },
      { id: "arxiv_cs_cv",       type: "rss", enabled: false, url: "https://export.arxiv.org/rss/cs.CV",                         weight: 0.07 },
      { id: "reddit_artificial", type: "rss", enabled: false, url: "https://www.reddit.com/r/artificial/.rss",                   weight: 0.08 },
      { id: "reddit_localllama", type: "rss", enabled: false, url: "https://www.reddit.com/r/LocalLLaMA/.rss",                   weight: 0.08 },
      { id: "towards_ds",        type: "rss", enabled: false, url: "https://towardsdatascience.com/feed",                        weight: 0.08 },
    ],
    dedupe: { by_url: true, by_title: true },
    created_at: new Date().toISOString(),
  };

  const existingPolicy = await adminFetch(
    "/items/ai_source_policies?limit=1&sort=-version&fields=id,version,policy_json",
    { method: "GET" },
  );

  const latestPolicy = (existingPolicy?.data ?? [])[0];
  if (!latestPolicy) {
    const createdPolicy = await adminFetch("/items/ai_source_policies", {
      method: "POST",
      body: JSON.stringify({
        name: defaultPolicy.name,
        version: defaultPolicy.version,
        policy_json: defaultPolicy,
      }),
    });
    console.log("[seed] created default source policy:", createdPolicy?.data?.id ?? createdPolicy);
  } else {
    const existingSources: unknown[] = latestPolicy?.policy_json?.sources ?? [];
    if (existingSources.length < defaultPolicy.sources.length) {
      const nextVersion = Number(latestPolicy?.version ?? 1) + 1;
      const createdPolicy = await adminFetch("/items/ai_source_policies", {
        method: "POST",
        body: JSON.stringify({
          name: defaultPolicy.name,
          version: nextVersion,
          policy_json: { ...defaultPolicy, version: nextVersion },
        }),
      });
      console.log("[seed] upgraded source policy:", createdPolicy?.data?.id ?? createdPolicy);
    } else {
      console.log("[seed] source policy already up to date, skipping.");
    }
  }

  const existingSource = await adminFetch("/items/ai_sources?limit=1&fields=id", { method: "GET" });
  if ((existingSource?.data ?? []).length === 0) {
    for (const source of defaultPolicy.sources) {
      await adminFetch("/items/ai_sources", {
        method: "POST",
        body: JSON.stringify({
          source_id: source.id,
          type: source.type,
          url: source.url,
          enabled: source.enabled,
          weight: source.weight,
          policy_name: defaultPolicy.name,
          policy_version: defaultPolicy.version,
          last_seen_at: new Date().toISOString(),
        }),
      });
    }
    console.log("[seed] created source snapshot records.");
  } else {
    console.log("[seed] sources already exist, skipping.");
  }
}

main().catch((err) => {
  console.error(`[seed] failed: ${err.message}`);
  process.exit(1);
});
