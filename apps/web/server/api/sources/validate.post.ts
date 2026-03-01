export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { url?: string };

  if (!body.url) throw createError({ statusCode: 400, message: "url is required" });

  let url: URL;
  try {
    url = new URL(body.url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { valid: false, error: "URL must use http or https" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(body.url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Validator/1.0)" }
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    // Check for RSS/Atom markers
    const isRss = text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF");
    if (!isRss) {
      return { valid: false, error: "URL does not appear to be an RSS/Atom feed" };
    }

    // Try to extract title
    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/i);
    const title = titleMatch?.[1]?.trim() ?? null;

    // Count items (rough estimate)
    const itemCount = (text.match(/<item[\s>]|<entry[\s>]/gi) ?? []).length;

    return { valid: true, title, itemCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("aborted") || msg.includes("abort")) {
      return { valid: false, error: "Request timed out after 6 seconds" };
    }
    return { valid: false, error: msg };
  }
});
