import type { GoalSpec, SourcePolicy } from "@mvp/schemas";

export interface DirectusClientOptions {
  baseUrl: string;
  adminToken: string;
}

interface CollectionSpec {
  collection: string;
  fields: Array<{ field: string; type: string }>;
}

const collectionSpecs: CollectionSpec[] = [
  {
    collection: "ai_goal_specs",
    fields: [
      { field: "name", type: "string" },
      { field: "version", type: "integer" },
      { field: "goal_json", type: "json" }
    ]
  },
  {
    collection: "ai_source_policies",
    fields: [
      { field: "name", type: "string" },
      { field: "version", type: "integer" },
      { field: "policy_json", type: "json" }
    ]
  },
  {
    collection: "ai_runs",
    fields: [
      { field: "run_key", type: "string" },
      { field: "mode", type: "string" },
      { field: "status", type: "string" },
      { field: "goal_name", type: "string" },
      { field: "report_markdown", type: "text" },
      { field: "report_json", type: "json" }
    ]
  },
  {
    collection: "ai_run_items",
    fields: [
      { field: "run_key", type: "string" },
      { field: "title", type: "string" },
      { field: "url", type: "string" },
      { field: "source", type: "string" },
      { field: "published_at", type: "dateTime" },
      { field: "summary", type: "text" },
      { field: "score", type: "float" },
      { field: "why_it_matters", type: "text" },
      { field: "risks", type: "text" },
      { field: "citations", type: "json" }
    ]
  }
];

export class DirectusClient {
  private readonly baseUrl: string;
  private readonly adminToken: string;

  constructor(options: DirectusClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.adminToken = options.adminToken;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.adminToken}`,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Directus ${response.status} ${path}: ${body}`);
    }

    // Directus may return 204/empty bodies for some write operations (e.g. DELETE).
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    const body = await response.text();
    if (!body.trim()) {
      return undefined as T;
    }

    return JSON.parse(body) as T;
  }

  async ping(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/server/ping`);
    if (!response.ok) {
      throw new Error("Directus not reachable");
    }
  }

  async ensureSchema(): Promise<void> {
    for (const spec of collectionSpecs) {
      await this.ensureCollection(spec.collection);
      for (const field of spec.fields) {
        await this.ensureField(spec.collection, field.field, field.type);
      }
    }
  }

  private async ensureCollection(name: string): Promise<void> {
    try {
      await this.request(`/collections/${name}`);
    } catch {
      await this.request("/collections", {
        method: "POST",
        body: JSON.stringify({
          collection: name,
          meta: { icon: "box" },
          schema: { name }
        })
      });
    }
  }

  private async ensureField(collection: string, field: string, type: string): Promise<void> {
    try {
      await this.request(`/fields/${collection}/${field}`);
    } catch {
      await this.request(`/fields/${collection}`, {
        method: "POST",
        body: JSON.stringify({
          field,
          type,
          meta: { interface: type === "json" ? "input-code" : "input" }
        })
      });
    }
  }

  async listLatest<T>(collection: string, jsonField: string): Promise<T | null> {
    const response = await this.request<{ data: Array<Record<string, unknown>> }>(
      `/items/${collection}?limit=1&sort=-version`
    );
    if (response.data.length === 0) {
      return null;
    }
    return (response.data[0][jsonField] as T) ?? null;
  }

  async listByName<T>(collection: string, name: string, jsonField: string): Promise<T | null> {
    const response = await this.request<{ data: Array<Record<string, unknown>> }>(
      `/items/${collection}?filter[name][_eq]=${encodeURIComponent(name)}&limit=1&sort=-version`
    );
    if (response.data.length === 0) {
      return null;
    }
    return (response.data[0][jsonField] as T) ?? null;
  }

  async createVersionedRecord(
    collection: "ai_goal_specs" | "ai_source_policies",
    payload: { name: string; version: number; json: GoalSpec | SourcePolicy }
  ): Promise<void> {
    const jsonField = collection === "ai_goal_specs" ? "goal_json" : "policy_json";
    await this.request(`/items/${collection}`, {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        version: payload.version,
        [jsonField]: payload.json
      })
    });
  }

  async createRun(input: {
    run_key: string;
    mode: string;
    status: string;
    goal_name?: string;
    report_markdown: string;
    report_json: unknown;
  }): Promise<void> {
    await this.request("/items/ai_runs", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async createItems(items: Array<Record<string, unknown>>): Promise<void> {
    for (const item of items) {
      await this.request("/items/ai_run_items", {
        method: "POST",
        body: JSON.stringify(item)
      });
    }
  }

  async createDiscoveryAnswer(input: {
    session_id: string;
    answers_json: unknown;
    created_at: string;
  }): Promise<void> {
    await this.request("/items/ai_discovery_answers", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async createFeedback(input: {
    run_key: string;
    item_url: string;
    rating: number;
    comment: string;
    created_at: string;
  }): Promise<void> {
    await this.request("/items/ai_feedback", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async getProject(): Promise<{
    id: number;
    name: string;
    timezone: string;
    schedule_cron: string;
    enabled: boolean;
  } | null> {
    const response = await this.request<{ data: Array<Record<string, unknown>> }>(
      "/items/ai_projects?limit=1"
    );
    return (response.data[0] as {
      id: number;
      name: string;
      timezone: string;
      schedule_cron: string;
      enabled: boolean;
    }) ?? null;
  }

  async updateProject(
    id: number,
    data: Partial<{ timezone: string; schedule_cron: string; enabled: boolean }>
  ): Promise<void> {
    await this.request(`/items/ai_projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }

  async getLatestSourcePolicyWithVersion(): Promise<{
    policy: SourcePolicy;
    version: number;
    name: string;
  } | null> {
    const response = await this.request<{ data: Array<Record<string, unknown>> }>(
      "/items/ai_source_policies?limit=1&sort=-version"
    );
    if (response.data.length === 0) return null;
    const row = response.data[0];
    return {
      policy: row["policy_json"] as SourcePolicy,
      version: row["version"] as number,
      name: row["name"] as string
    };
  }

  async createSourcesSnapshot(
    sources: Array<{
      source_id: string;
      type: "rss" | "api";
      url: string;
      enabled: boolean;
      weight: number;
      policy_name: string;
      policy_version: number;
      last_seen_at: string;
    }>
  ): Promise<void> {
    for (const source of sources) {
      await this.request("/items/ai_sources", {
        method: "POST",
        body: JSON.stringify(source)
      });
    }
  }
}

export const waitForDirectus = async (client: DirectusClient, retries = 30): Promise<void> => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await client.ping();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error("Directus not ready after retries");
};
