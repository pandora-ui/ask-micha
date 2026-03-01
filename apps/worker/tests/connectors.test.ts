import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Parser from "rss-parser";
import { parseRssItems } from "../src/connectors/rss";
import { parseApiResponse } from "../src/connectors/api";

describe("connector parsing", () => {
  it("parses RSS fixture", async () => {
    const parser = new Parser();
    const xml = readFileSync(resolve(process.cwd(), "tests/fixtures/rss.xml"), "utf-8");
    const feed = await parser.parseString(xml);

    const items = parseRssItems("hn_rss", (feed.items ?? []) as any[]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].citation_urls.length).toBeGreaterThan(0);
  });

  it("parses API fixture", () => {
    const fixture = JSON.parse(
      readFileSync(resolve(process.cwd(), "tests/fixtures/api.json"), "utf-8")
    ) as { hits: any[] };

    const items = parseApiResponse("hn_api", fixture);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].url.startsWith("http")).toBe(true);
  });
});
