import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../../../.env")
];

const envFile = envCandidates.find((candidate) => existsSync(candidate));
if (envFile) {
  dotenv.config({ path: envFile });
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

export const env = {
  directusUrl: required("DIRECTUS_URL"),
  directusAdminToken: required("DIRECTUS_ADMIN_TOKEN"),
  openAiApiKey: required("OPENAI_API_KEY"),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
};
