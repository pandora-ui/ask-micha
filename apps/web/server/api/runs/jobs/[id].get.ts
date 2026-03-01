import { getRunJob } from "../../../utils/run-jobs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "missing id" });
  }

  const job = getRunJob(id);
  if (!job) {
    throw createError({ statusCode: 404, message: "job not found" });
  }

  return job;
});
