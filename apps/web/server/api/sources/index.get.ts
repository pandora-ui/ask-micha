import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

const KNOWN_LABELS: Record<string, string> = {
  hn_rss: "Hacker News",
  hn_api: "Hacker News API",
  arxiv_cs_ai: "ArXiv — AI",
  arxiv_cs_lg: "ArXiv — Machine Learning",
  arxiv_cs_cl: "ArXiv — NLP",
  arxiv_cs_cv: "ArXiv — Computer Vision",
  lobsters_rss: "Lobsters",
  techcrunch_ai: "TechCrunch AI",
  github_blog: "GitHub Blog",
  verge_ai: "The Verge AI",
  ieee_ai: "IEEE Spectrum AI",
  openai_blog: "OpenAI Blog",
  anthropic_blog: "Anthropic Blog",
  deepmind_blog: "DeepMind Blog",
  venturebeat_ai: "VentureBeat AI",
  mit_ai_news: "MIT News — AI",
  reddit_ml: "Reddit — MachineLearning",
  google_ai_blog: "Google AI Blog",
  microsoft_ai_blog: "Microsoft AI Blog",
  huggingface_blog: "Hugging Face Blog",
  mit_tech_review_ai: "MIT Technology Review AI",
  ars_technica_ai: "Ars Technica AI",
  reddit_artificial: "Reddit — artificial",
  reddit_localllama: "Reddit — LocalLLaMA",
  a16z_blog: "a16z Blog",
  towards_ds: "Towards Data Science",
  product_hunt: "Product Hunt"
};

function idToLabel(id: string): string {
  if (KNOWN_LABELS[id]) return KNOWN_LABELS[id];
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default defineEventHandler(async () => {
  try {
    const directus = getDirectusClient();
    const result = await directus.getLatestSourcePolicyWithVersion();
    const policy = result?.policy ?? defaultSourcePolicy();

    return {
      sources: policy.sources.map((s) => ({
        ...s,
        label: idToLabel(s.id)
      }))
    };
  } catch {
    return { sources: [] };
  }
});
