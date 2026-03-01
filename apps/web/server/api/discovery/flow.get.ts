import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export default defineEventHandler(async () => {
  const file = resolve(process.cwd(), "flow/discovery-flow.json");
  const raw = await readFile(file, "utf-8");
  return JSON.parse(raw);
});
