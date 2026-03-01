import "dotenv/config";
import process from "node:process";

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? "http://localhost:8055";
const TIMEOUT_MS = Number(process.env.DIRECTUS_WAIT_TIMEOUT_MS ?? 120000);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const start = Date.now();
  const url = `${DIRECTUS_URL.replace(/\/$/, "")}/server/ping`;

  while (true) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        const txt = await res.text();
        console.log(`[directus:wait] ready: ${url} -> ${txt}`);
        return;
      }
      console.log(`[directus:wait] not ready yet: ${res.status}`);
    } catch (e) {
      console.log(`[directus:wait] error: ${(e as Error).message}`);
    }

    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error(`Timeout waiting for Directus at ${url}`);
    }
    await sleep(1500);
  }
}

main().catch((err) => {
  console.error(`[directus:wait] failed: ${err.message}`);
  process.exit(1);
});
