import { validateGoalSpec, validateSourcePolicy } from "@mvp/schemas";
import { DirectusClient, defaultGoalSpec, defaultSourcePolicy, waitForDirectus } from "@mvp/shared";
import { env } from "./env";

const run = async (): Promise<void> => {
  const client = new DirectusClient({
    baseUrl: env.directusUrl,
    adminToken: env.directusAdminToken
  });

  await waitForDirectus(client);
  await client.ensureSchema();

  const latestGoalSpec = await client.listLatest("ai_goal_specs", "goal_json");
  const latestPolicy = await client.listLatest("ai_source_policies", "policy_json");

  if (!latestGoalSpec) {
    const goal = validateGoalSpec(defaultGoalSpec());
    await client.createVersionedRecord("ai_goal_specs", {
      name: goal.name,
      version: goal.version,
      json: goal
    });
  }

  if (!latestPolicy) {
    const policy = validateSourcePolicy(defaultSourcePolicy());
    await client.createVersionedRecord("ai_source_policies", {
      name: policy.name,
      version: policy.version,
      json: policy
    });
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
