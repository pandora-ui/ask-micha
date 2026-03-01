import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const directus = getDirectusClient();
  const body = (await readBody(event)) as {
    run_key: string;
    item_url: string;
    rating: number;
    comment?: string;
  };

  if (!body.run_key || !body.item_url) {
    throw createError({ statusCode: 400, message: "run_key and item_url are required" });
  }

  if (!Number.isFinite(body.rating) || body.rating < 1 || body.rating > 5) {
    throw createError({ statusCode: 400, message: "rating must be between 1 and 5" });
  }

  await directus.createFeedback({
    run_key: body.run_key,
    item_url: body.item_url,
    rating: Math.round(body.rating),
    comment: (body.comment ?? "").trim(),
    created_at: new Date().toISOString()
  });

  return { ok: true };
});
