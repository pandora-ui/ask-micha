import type { NormalizedItem } from "./types";

const normalize = (input: string): string => input.trim().toLowerCase();

export const dedupeItems = (
  items: NormalizedItem[],
  options: { by_url: boolean; by_title: boolean }
): NormalizedItem[] => {
  const seen = new Set<string>();
  const result: NormalizedItem[] = [];

  for (const item of items) {
    const keys: string[] = [];
    if (options.by_url) keys.push(`u:${normalize(item.url)}`);
    if (options.by_title) keys.push(`t:${normalize(item.title)}`);

    const duplicate = keys.some((key) => seen.has(key));
    if (duplicate) {
      continue;
    }

    keys.forEach((key) => seen.add(key));
    result.push(item);
  }

  return result;
};
