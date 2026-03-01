import { randomUUID } from "node:crypto";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const directus = getDirectusClient();
  const body = (await readBody(event)) as { answers: Record<string, unknown> };

  let sessionId = getCookie(event, "discovery_session");
  if (!sessionId) {
    sessionId = randomUUID();
    setCookie(event, "discovery_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }

  await directus.createDiscoveryAnswer({
    session_id: sessionId,
    answers_json: body.answers ?? {},
    created_at: new Date().toISOString()
  });

  return { ok: true, sessionId };
});
