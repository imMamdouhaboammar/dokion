import { join } from "node:path";

import { sha256 } from "../core/digest.ts";
import { writeTextAtomic } from "../core/json.ts";
import {
  captureRepairSnapshot,
  diffRepairSnapshots,
  isTestPath,
  renderRepairDelta,
  snapshotText,
  type RepairSnapshot
} from "./repair-snapshot.ts";

export interface RepairValidationPolicy {
  suppression_detection?: boolean;
  forbid_test_deletion?: boolean;
  forbid_out_of_scope_edits?: boolean;
  require_regression_test?: boolean;
  max_diff_lines?: number;
}

export interface RepairValidationResult {
  verdict: "FIX_HOLDS" | "FIX_IS_SUPPRESSION" | "FIX_INCOMPLETE";
  violations: string[];
  changedPaths: string[];
  changedTestPaths: string[];
  diffArtifact: string;
  diffDigest: string;
  diff: string;
  after: RepairSnapshot;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globRegex(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(character);
    }
  }
  return new RegExp(`^${source}$`);
}

function matchesAny(path: string, scopes: string[]): boolean {
  return scopes.some((scope) => globRegex(scope).test(path));
}

const suppressionPatterns: Array<[string, RegExp]> = [
  ["nosec", /(?:#|\/\/|\/\*)\s*nosec\b|\bnoqa\b/i],
  ["eslint-disable", /eslint-disable(?:-next-line|-line)?/i],
  ["ts-ignore", /@ts-ignore|@ts-nocheck/i],
  ["type-ignore", /#\s*type:\s*ignore/i],
  ["semgrep-ignore", /nosemgrep|\.semgrepignore/i],
  ["coverage-ignore", /istanbul\s+ignore|coverage:\s*ignore/i],
  ["test-skip", /\b(?:test|it|describe)\.(?:skip|todo)\b|\bx(?:it|describe)\s*\(/i]
];

function countMatches(text: string | undefined, pattern: RegExp): number {
  if (!text) return 0;
  const flags = `${pattern.flags.replaceAll("g", "")}g`;
  return Array.from(text.matchAll(new RegExp(pattern.source, flags))).length;
}

function lineHistogram(text: string | undefined): Map<string, number> {
  const histogram = new Map<string, number>();
  for (const line of (text ?? "").split("\n")) histogram.set(line, (histogram.get(line) ?? 0) + 1);
  return histogram;
}

function changedLineCount(before: string | undefined, after: string | undefined): number {
  const left = lineHistogram(before);
  const right = lineHistogram(after);
  const lines = new Set([...left.keys(), ...right.keys()]);
  let count = 0;
  for (const line of lines) count += Math.abs((left.get(line) ?? 0) - (right.get(line) ?? 0));
  return count;
}

export async function validateRepair(input: {
  root: string;
  runId: string;
  findingId: string;
  writeScopes: string[];
  policy: RepairValidationPolicy;
  before: RepairSnapshot;
}): Promise<RepairValidationResult> {
  const after = await captureRepairSnapshot(input.root);
  const delta = diffRepairSnapshots(input.before, after);
  const violations: string[] = [];
  const allowedScopes = [...input.writeScopes, ".dokion/**", "HARDENING.md"];

  if (input.policy.forbid_out_of_scope_edits !== false) {
    for (const path of delta.changedPaths) {
      if (!matchesAny(path, allowedScopes)) violations.push(`out-of-scope edit: ${path}`);
    }
  }

  if (input.policy.forbid_test_deletion !== false) {
    for (const path of delta.deletedPaths) {
      if (isTestPath(path)) violations.push(`test deleted: ${path}`);
    }
  }

  let suppressionDetected = false;
  if (input.policy.suppression_detection !== false) {
    for (const path of delta.changedPaths) {
      const beforeText = snapshotText(input.before.files[path]);
      const afterText = snapshotText(after.files[path]);
      for (const [label, pattern] of suppressionPatterns) {
        if (countMatches(afterText, pattern) > countMatches(beforeText, pattern)) {
          violations.push(`suppression directive added: ${label}`);
          suppressionDetected = true;
        }
      }
    }
  }

  if (input.policy.require_regression_test && delta.changedTestPaths.length === 0) {
    violations.push("repair did not add or modify a regression test");
  }

  if (input.policy.max_diff_lines !== undefined) {
    const count = delta.changedPaths.reduce(
      (total, path) => total + changedLineCount(snapshotText(input.before.files[path]), snapshotText(after.files[path])),
      0
    );
    if (count > input.policy.max_diff_lines) violations.push(`diff exceeds max_diff_lines: ${count} > ${input.policy.max_diff_lines}`);
  }

  const diff = renderRepairDelta(input.before, after, delta);
  const diffArtifact = `.dokion/evidence/${input.runId}/findings/${input.findingId}/repair.diff`;
  await writeTextAtomic(join(input.root, diffArtifact), diff);
  return {
    verdict: suppressionDetected ? "FIX_IS_SUPPRESSION" : violations.length > 0 ? "FIX_INCOMPLETE" : "FIX_HOLDS",
    violations: Array.from(new Set(violations)),
    changedPaths: delta.changedPaths,
    changedTestPaths: delta.changedTestPaths,
    diffArtifact,
    diffDigest: sha256(diff),
    diff,
    after
  };
}
