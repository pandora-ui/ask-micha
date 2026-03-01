import type { GoalSpec, SourcePolicy } from "@mvp/schemas";

export const defaultGoalSpec = (): GoalSpec => ({
  name: "My Intelligence Watch",
  version: 1,
  focus_topics: [],
  excluded_topics: [],
  target_audience: "General",
  lookback_days: 7,
  max_items: 20,
  scoring_weights: {
    recency: 0.4,
    relevance: 0.4,
    source_trust: 0.2
  },
  must_include_keywords: [],
  created_at: new Date().toISOString()
});

export const defaultSourcePolicy = (): SourcePolicy => ({
  name: "Default Source Policy",
  version: 1,
  sources: [
    // ── General / always-on ──────────────────────────────────────────────
    {
      id: "hn_rss",
      type: "rss",
      enabled: true,
      url: "https://hnrss.org/frontpage",
      weight: 0.2
    },
    {
      id: "hn_api",
      type: "api",
      enabled: true,
      url: "https://hn.algolia.com/api/v1/search_by_date?tags=story",
      weight: 0.15
    },
    {
      id: "lobsters_rss",
      type: "rss",
      enabled: true,
      url: "https://lobste.rs/rss",
      weight: 0.1
    },
    {
      id: "github_blog",
      type: "rss",
      enabled: true,
      url: "https://github.blog/feed/",
      weight: 0.1
    },
    {
      id: "a16z_blog",
      type: "rss",
      enabled: true,
      url: "https://a16z.com/feed/",
      weight: 0.1
    },
    {
      id: "product_hunt",
      type: "rss",
      enabled: true,
      url: "https://www.producthunt.com/feed",
      weight: 0.07
    },
    // ── AI & Research (disabled by default, enable via Sources page) ─────
    {
      id: "arxiv_cs_ai",
      type: "rss",
      enabled: false,
      url: "https://export.arxiv.org/rss/cs.AI",
      weight: 0.15
    },
    {
      id: "techcrunch_ai",
      type: "rss",
      enabled: false,
      url: "https://techcrunch.com/tag/artificial-intelligence/feed/",
      weight: 0.12
    },
    {
      id: "verge_ai",
      type: "rss",
      enabled: false,
      url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      weight: 0.1
    },
    {
      id: "ieee_ai",
      type: "rss",
      enabled: false,
      url: "https://spectrum.ieee.org/rss/topic/artificial-intelligence",
      weight: 0.08
    },
    {
      id: "openai_blog",
      type: "rss",
      enabled: false,
      url: "https://openai.com/blog/rss.xml",
      weight: 0.15
    },
    {
      id: "anthropic_blog",
      type: "rss",
      enabled: false,
      url: "https://www.anthropic.com/blog/rss.xml",
      weight: 0.15
    },
    {
      id: "deepmind_blog",
      type: "rss",
      enabled: false,
      url: "https://deepmind.google/discover/blog/rss.xml",
      weight: 0.12
    },
    {
      id: "venturebeat_ai",
      type: "rss",
      enabled: false,
      url: "https://venturebeat.com/category/ai/feed/",
      weight: 0.1
    },
    {
      id: "mit_ai_news",
      type: "rss",
      enabled: false,
      url: "https://news.mit.edu/topic/artificial-intelligence2/rss.xml",
      weight: 0.1
    },
    {
      id: "arxiv_cs_lg",
      type: "rss",
      enabled: false,
      url: "https://export.arxiv.org/rss/cs.LG",
      weight: 0.1
    },
    {
      id: "arxiv_cs_cl",
      type: "rss",
      enabled: false,
      url: "https://export.arxiv.org/rss/cs.CL",
      weight: 0.08
    },
    {
      id: "reddit_ml",
      type: "rss",
      enabled: false,
      url: "https://www.reddit.com/r/MachineLearning/.rss",
      weight: 0.08
    },
    {
      id: "google_ai_blog",
      type: "rss",
      enabled: false,
      url: "https://blog.google/technology/ai/rss/",
      weight: 0.15
    },
    {
      id: "microsoft_ai_blog",
      type: "rss",
      enabled: false,
      url: "https://blogs.microsoft.com/ai/feed/",
      weight: 0.12
    },
    {
      id: "huggingface_blog",
      type: "rss",
      enabled: false,
      url: "https://huggingface.co/blog/rss.xml",
      weight: 0.12
    },
    {
      id: "mit_tech_review_ai",
      type: "rss",
      enabled: false,
      url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
      weight: 0.12
    },
    {
      id: "ars_technica_ai",
      type: "rss",
      enabled: false,
      url: "https://arstechnica.com/ai/feed/",
      weight: 0.1
    },
    {
      id: "arxiv_cs_cv",
      type: "rss",
      enabled: false,
      url: "https://export.arxiv.org/rss/cs.CV",
      weight: 0.07
    },
    {
      id: "reddit_artificial",
      type: "rss",
      enabled: false,
      url: "https://www.reddit.com/r/artificial/.rss",
      weight: 0.08
    },
    {
      id: "reddit_localllama",
      type: "rss",
      enabled: false,
      url: "https://www.reddit.com/r/LocalLLaMA/.rss",
      weight: 0.08
    },
    {
      id: "towards_ds",
      type: "rss",
      enabled: false,
      url: "https://towardsdatascience.com/feed",
      weight: 0.08
    }
  ],
  dedupe: {
    by_url: true,
    by_title: true
  },
  created_at: new Date().toISOString()
});
