import type { NormalizedItem } from "@mvp/shared";

interface HnApiHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  url: string | null;
  created_at: string;
}

interface HnApiResponse {
  hits: HnApiHit[];
}

export const parseApiResponse = (sourceId: string, payload: HnApiResponse): NormalizedItem[] => {
  return payload.hits
    .filter((hit) => hit.title && hit.url)
    .map((hit) => ({
      id: `${sourceId}:${hit.objectID}`,
      source_id: sourceId,
      source_type: "api",
      title: hit.title ?? "Untitled",
      url: hit.url ?? "",
      summary: hit.story_text ?? "",
      published_at: hit.created_at,
      citation_urls: hit.url ? [hit.url] : []
    }));
};

export const fetchApi = async (sourceId: string, url: string): Promise<NormalizedItem[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API fetch failed (${response.status})`);
  }
  const json = (await response.json()) as HnApiResponse;
  return parseApiResponse(sourceId, json);
};
