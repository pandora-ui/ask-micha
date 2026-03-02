import { validateSourcePolicy, type SourcePolicy } from "@mvp/schemas";
import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

function urlToId(url: string, type: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const base = hostname.split(".")[0] ?? "source";
    return `${base}_${type}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  } catch {
    return `source_${type}_${Date.now()}`;
  }
}

function ensureUniqueId(id: string, existing: SourcePolicy["sources"]): string {
  const ids = new Set(existing.map((s) => s.id));
  if (!ids.has(id)) return id;
  let i = 2;
  while (ids.has(`${id}_${i}`)) i++;
  return `${id}_${i}`;
}

interface BulkSource {
  url: string;
  type: "rss" | "api";
  label?: string;
  weight?: number;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { sources: BulkSource[] };

  if (!Array.isArray(body.sources) || body.sources.length === 0) {
    throw createError({ statusCode: 400, message: "sources array is required and must not be empty" });
  }

  const directus = getDirectusClient();
  const result = await directus.getLatestSourcePolicyWithVersion();
  const current = result?.policy ?? defaultSourcePolicy();
  const nextVersion = (result?.version ?? current.version) + 1;

  const existingUrls = new Set(current.sources.map((s) => s.url));
  const newSources: SourcePolicy["sources"][number][] = [];

  for (const src of body.sources) {
    if (!src.url || !["rss", "api"].includes(src.type)) continue;
    if (existingUrls.has(src.url)) continue; // skip duplicates
    existingUrls.add(src.url); // track within this batch too

    const id = ensureUniqueId(
      urlToId(src.url, src.type),
      [...current.sources, ...newSources]
    );

    newSources.push({
      id,
      type: src.type,
      enabled: true,
      url: src.url,
      weight: Math.min(1, Math.max(0, src.weight ?? 0.1))
    });
  }

  if (newSources.length === 0) {
    return { added: 0, message: "No new sources to add (all duplicates or invalid)" };
  }

  const nextPolicy = validateSourcePolicy({
    ...current,
    version: nextVersion,
    sources: [...current.sources, ...newSources],
    created_at: new Date().toISOString()
  });

  await directus.createVersionedRecord("ai_source_policies", {
    name: nextPolicy.name,
    version: nextPolicy.version,
    json: nextPolicy
  });

  return {
    added: newSources.length,
    sources: newSources.map((s) => ({ id: s.id, url: s.url, type: s.type, weight: s.weight }))
  };
});
