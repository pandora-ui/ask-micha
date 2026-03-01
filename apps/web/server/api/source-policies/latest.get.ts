import { validateSourcePolicy } from "@mvp/schemas";
import { defaultSourcePolicy } from "@mvp/shared";
import { getDirectusClient } from "../../utils/directus";

export default defineEventHandler(async () => {
  const directus = getDirectusClient();
  const latest = await directus.listLatest("ai_source_policies", "policy_json");
  return {
    sourcePolicy: validateSourcePolicy(latest ?? defaultSourcePolicy())
  };
});
