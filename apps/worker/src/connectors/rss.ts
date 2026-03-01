import Parser from "rss-parser";
import type { NormalizedItem } from "@mvp/shared";

interface RssItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  isoDate?: string;
}

const parser = new Parser();

export const parseRssItems = (sourceId: string, items: RssItem[]): NormalizedItem[] => {
  return items
    .filter((item) => item.title && item.link)
    .map((item, index) => ({
      id: `${sourceId}:${index}:${item.link}`,
      source_id: sourceId,
      source_type: "rss",
      title: item.title ?? "Untitled",
      url: item.link ?? "",
      summary: item.contentSnippet ?? "",
      published_at: item.isoDate ?? new Date().toISOString(),
      citation_urls: item.link ? [item.link] : []
    }));
};

export const fetchRss = async (sourceId: string, url: string): Promise<NormalizedItem[]> => {
  const feed = await parser.parseURL(url);
  return parseRssItems(sourceId, feed.items as RssItem[]);
};
