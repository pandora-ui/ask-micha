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

type GenericRecord = Record<string, unknown>;

const toText = (value: unknown): string => (typeof value === "string" ? value : "");

const mapHnHits = (sourceId: string, payload: HnApiResponse): NormalizedItem[] => {
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

const mapPatentView = (sourceId: string, payload: GenericRecord): NormalizedItem[] => {
  const patents = Array.isArray(payload.patents) ? (payload.patents as GenericRecord[]) : [];
  return patents
    .filter((patent) => typeof patent.patent_title === "string")
    .map((patent, idx) => {
      const number = toText(patent.patent_number) || `pv-${idx + 1}`;
      const title = toText(patent.patent_title) || "Untitled patent";
      const date = toText(patent.patent_date) || new Date().toISOString();
      const url = `https://patents.google.com/patent/US${number}`;
      return {
        id: `${sourceId}:patent:${number}`,
        source_id: sourceId,
        source_type: "api" as const,
        title,
        url,
        summary: `Patent ${number} published on ${date}`,
        published_at: date,
        citation_urls: [url]
      };
    });
};

const mapGenericRecords = (sourceId: string, records: GenericRecord[]): NormalizedItem[] => {
  return records
    .map((item, idx) => {
      const title =
        toText(item.title) ||
        toText(item.name) ||
        toText(item.headline) ||
        toText(item.patent_title);
      const url =
        toText(item.url) ||
        toText(item.link) ||
        toText(item.story_url);
      const summary =
        toText(item.summary) ||
        toText(item.description) ||
        toText(item.story_text);
      const publishedAt =
        toText(item.published_at) ||
        toText(item.created_at) ||
        toText(item.date) ||
        new Date().toISOString();
      const stableId =
        toText(item.id) ||
        toText(item.objectID) ||
        `${idx + 1}`;

      if (!title || !url) return null;

      return {
        id: `${sourceId}:generic:${stableId}`,
        source_id: sourceId,
        source_type: "api" as const,
        title,
        url,
        summary,
        published_at: publishedAt,
        citation_urls: [url]
      };
    })
    .filter((item): item is NormalizedItem => item !== null);
};

export const parseApiResponse = (sourceId: string, payload: unknown): NormalizedItem[] => {
  if (!payload || typeof payload !== "object") return [];

  const data = payload as GenericRecord;

  if (Array.isArray((data as HnApiResponse).hits)) {
    return mapHnHits(sourceId, data as HnApiResponse);
  }

  if (Array.isArray(data.patents)) {
    return mapPatentView(sourceId, data);
  }

  if (Array.isArray(data.items)) {
    return mapGenericRecords(sourceId, data.items as GenericRecord[]);
  }

  if (Array.isArray(payload)) {
    return mapGenericRecords(sourceId, payload as GenericRecord[]);
  }

  return [];
};

export const fetchApi = async (sourceId: string, url: string): Promise<NormalizedItem[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API fetch failed (${response.status})`);
  }
  const json = (await response.json()) as unknown;
  return parseApiResponse(sourceId, json);
};
