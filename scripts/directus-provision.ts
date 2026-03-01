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

type CollectionInput = {
  collection: string;
  meta?: { icon?: string; note?: string };
  schema: { name: string };
};

const collections: CollectionInput[] = [
  {
    collection: "ai_projects",
    meta: { icon: "folder", note: "Micha projects" },
    schema: { name: "ai_projects" },
  },
  {
    collection: "ai_discovery_answers",
    meta: { icon: "quiz", note: "Wizard answers" },
    schema: { name: "ai_discovery_answers" },
  },
  {
    collection: "ai_goal_specs",
    meta: { icon: "target", note: "Versioned goal specs" },
    schema: { name: "ai_goal_specs" },
  },
  {
    collection: "ai_source_policies",
    meta: { icon: "shield", note: "Versioned source policies" },
    schema: { name: "ai_source_policies" },
  },
  {
    collection: "ai_sources",
    meta: { icon: "link", note: "Materialized sources for UI" },
    schema: { name: "ai_sources" },
  },
  {
    collection: "ai_runs",
    meta: { icon: "play_circle", note: "Runs" },
    schema: { name: "ai_runs" },
  },
  {
    collection: "ai_run_items",
    meta: { icon: "list", note: "Run items" },
    schema: { name: "ai_run_items" },
  },
  {
    collection: "ai_feedback",
    meta: { icon: "thumb_up", note: "Feedback" },
    schema: { name: "ai_feedback" },
  },
];

type FieldInput = {
  field: string;
  type: string;
  meta?: { interface?: string };
};

const fieldsByCollection: Record<string, FieldInput[]> = {
  ai_projects: [
    { field: "name", type: "string" },
    { field: "timezone", type: "string" },
    { field: "schedule_cron", type: "string" },
    { field: "enabled", type: "boolean" },
  ],
  ai_discovery_answers: [
    { field: "session_id", type: "string" },
    { field: "answers_json", type: "json", meta: { interface: "input-code" } },
    { field: "created_at", type: "dateTime" },
  ],
  ai_goal_specs: [
    { field: "name", type: "string" },
    { field: "version", type: "integer" },
    { field: "goal_json", type: "json", meta: { interface: "input-code" } },
  ],
  ai_sources: [
    { field: "source_id", type: "string" },
    { field: "type", type: "string" },
    { field: "url", type: "string" },
    { field: "enabled", type: "boolean" },
    { field: "weight", type: "float" },
    { field: "policy_name", type: "string" },
    { field: "policy_version", type: "integer" },
    { field: "last_seen_at", type: "dateTime" },
  ],
  ai_source_policies: [
    { field: "name", type: "string" },
    { field: "version", type: "integer" },
    { field: "policy_json", type: "json", meta: { interface: "input-code" } },
  ],
  ai_runs: [
    { field: "run_key", type: "string" },
    { field: "mode", type: "string" },
    { field: "status", type: "string" },
    { field: "goal_name", type: "string" },
    { field: "report_markdown", type: "text" },
    { field: "report_json", type: "json", meta: { interface: "input-code" } },
  ],
  ai_run_items: [
    { field: "run_key", type: "string" },
    { field: "title", type: "string" },
    { field: "url", type: "string" },
    { field: "source", type: "string" },
    { field: "published_at", type: "dateTime" },
    { field: "summary", type: "text" },
    { field: "score", type: "float" },
    { field: "why_it_matters", type: "text" },
    { field: "risks", type: "text" },
    { field: "citations", type: "json", meta: { interface: "input-code" } },
  ],
  ai_feedback: [
    { field: "run_key", type: "string" },
    { field: "item_url", type: "string" },
    { field: "rating", type: "integer" },
    { field: "comment", type: "text" },
    { field: "created_at", type: "dateTime" },
  ],
};

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
  if (!res.ok) {
    throw new Error(`Directus API ${path} failed: ${res.status} ${text}`);
  }
  return json;
}

async function collectionExists(name: string) {
  try {
    return await adminFetch(`/collections/${name}`, { method: "GET" });
  } catch {
    return null;
  }
}

async function createCollection(input: CollectionInput) {
  // Directus expects { collection, meta, schema } in POST /collections
  await adminFetch(`/collections`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function fieldExists(collection: string, field: string) {
  try {
    await adminFetch(`/fields/${collection}/${field}`, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

async function createField(collection: string, input: FieldInput) {
  await adminFetch(`/fields/${collection}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function main() {
  console.log(`[directus:provision] directus=${DIRECTUS_URL}`);

  for (const c of collections) {
    const existing = await collectionExists(c.collection);
    if (existing) {
      if (!existing?.data?.schema?.name) {
        throw new Error(
          `Collection ${c.collection} exists without SQL schema/table. Recreate Directus DB and provision again.`,
        );
      }
      console.log(`[directus:provision] exists: ${c.collection}`);
      continue;
    }
    console.log(`[directus:provision] creating: ${c.collection}`);
    await createCollection(c);
  }

  for (const [collection, fields] of Object.entries(fieldsByCollection)) {
    for (const field of fields) {
      const exists = await fieldExists(collection, field.field);
      if (exists) {
        console.log(`[directus:provision] field exists: ${collection}.${field.field}`);
        continue;
      }
      console.log(`[directus:provision] creating field: ${collection}.${field.field}`);
      await createField(collection, field);
    }
  }

  console.log("[directus:provision] done (collections + fields).");
}

main().catch((err) => {
  console.error(`[directus:provision] failed: ${err.message}`);
  process.exit(1);
});
