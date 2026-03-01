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

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as {
    label?: string;
    type: "rss" | "api";
    url: string;
    weight?: number;
  };

  if (!body.url) throw createError({ statusCode: 400, message: "url is required" });
  if (!["rss", "api"].includes(body.type)) {
    throw createError({ statusCode: 400, message: "type must be rss or api" });
  }

  const directus = getDirectusClient();
  const result = await directus.getLatestSourcePolicyWithVersion();
  const current = result?.policy ?? defaultSourcePolicy();
  const nextVersion = (result?.version ?? current.version) + 1;

  const id = ensureUniqueId(urlToId(body.url, body.type), current.sources);

  const newSource = {
    id,
    type: body.type,
    enabled: true,
    url: body.url,
    weight: Math.min(1, Math.max(0, body.weight ?? 0.1))
  };

  const nextPolicy = validateSourcePolicy({
    ...current,
    version: nextVersion,
    sources: [...current.sources, newSource],
    created_at: new Date().toISOString()
  });

  await directus.createVersionedRecord("ai_source_policies", {
    name: nextPolicy.name,
    version: nextPolicy.version,
    json: nextPolicy
  });

  return { source: { ...newSource, label: body.label ?? id } };
});
