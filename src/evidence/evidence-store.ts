import { relative, join } from "node:path";

import { writeJsonAtomic } from "../core/json.ts";

export interface CommandEvidence {
  run_id: string;
  stage_id: string;
  step_id: string;
  command_index: number;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  commit_sha?: string;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function writeCommandEvidence(root: string, evidence: CommandEvidence): Promise<string> {
  const path = join(
    root,
    ".dokion",
    "evidence",
    safeSegment(evidence.stage_id),
    safeSegment(evidence.step_id),
    `verification-${evidence.command_index}.json`
  );

  await writeJsonAtomic(path, evidence);
  return relative(root, path);
}
