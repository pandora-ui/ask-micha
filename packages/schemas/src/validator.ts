import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";
import { goalSpecSchema, type GoalSpec } from "./goal-spec.schema";
import { sourcePolicySchema, type SourcePolicy } from "./source-policy.schema";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validateGoalSpecFn = ajv.compile(goalSpecSchema);
const validateSourcePolicyFn = ajv.compile(sourcePolicySchema);

const errorsToString = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors || errors.length === 0) {
    return "Unknown validation error";
  }
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
};

export const validateGoalSpec = (input: unknown): GoalSpec => {
  if (!validateGoalSpecFn(input)) {
    throw new Error(`Invalid GoalSpec: ${errorsToString(validateGoalSpecFn.errors)}`);
  }
  return input;
};

export const validateSourcePolicy = (input: unknown): SourcePolicy => {
  if (!validateSourcePolicyFn(input)) {
    throw new Error(`Invalid SourcePolicy: ${errorsToString(validateSourcePolicyFn.errors)}`);
  }
  return input;
};
