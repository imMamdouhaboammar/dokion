import { renderExecutionPlan, type ExecutionPlan } from "../../plan/render-plan.ts";

export async function handlePlan(
  root: string,
  environment: NodeJS.ProcessEnv = process.env
): Promise<ExecutionPlan> {
  return renderExecutionPlan(root, environment);
}
