import { relative, join } from "node:path";

import { sha256 } from "../core/digest.ts";
import { writeTextAtomic } from "../core/json.ts";

export interface RepairValidationPolicy {
  suppression_detection?: boolean;
  forbid_test_deletion?: boolean;
  forbid_out_of_scope_edits?: boolean;
  max_diff_lines?: number;
}

export interface RepairValidationResult {
  verdict: "FIX_HOLDS" | "FIX_IS_SUPPRESSION" | "FIX_INCOMPLETE";
  violations: string[];
  changedPaths: string[];
  diffArtifact: string;
  diffDigest: string;
  diff: string;
}

async function git(root: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  return { exitCode, stdout, stderr };
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

function parseNameStatus(raw: string): Array<{ status: string; path: string }> {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status = "", ...pathParts] = line.split("\t");
      return { status, path: pathParts.at(-1) ?? "" };
    })
    .filter((entry) => entry.path.length > 0);
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

export async function validateRepair(input: {
  root: string;
  runId: string;
  findingId: string;
  writeScopes: string[];
  policy: RepairValidationPolicy;
}): Promise<RepairValidationResult> {
  const diffResult = await git(input.root, ["diff", "--no-ext-diff", "--unified=3", "--", "."]);
  if (diffResult.exitCode !== 0) {
    throw new Error(`git diff failed: ${diffResult.stderr}`);
  }
  const statusResult = await git(input.root, ["diff", "--name-status", "--", "."]);
  if (statusResult.exitCode !== 0) {
    throw new Error(`git diff --name-status failed: ${statusResult.stderr}`);
  }

  const entries = parseNameStatus(statusResult.stdout);
  const changedPaths = entries.map((entry) => entry.path);
  const violations: string[] = [];
  const allowedScopes = [...input.writeScopes, ".dokion/**", "HARDENING.md"];

  if (input.policy.forbid_out_of_scope_edits !== false) {
    for (const path of changedPaths) {
      if (!matchesAny(path, allowedScopes)) {
        violations.push(`out-of-scope edit: ${path}`);
      }
    }
  }

  if (input.policy.forbid_test_deletion !== false) {
    for (const entry of entries) {
      if (entry.status.startsWith("D") && /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\.[^.]+$/i.test(entry.path)) {
        violations.push(`test deleted: ${entry.path}`);
      }
    }
  }

  const addedLines = diffResult.stdout
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
  let suppressionDetected = false;
  if (input.policy.suppression_detection !== false) {
    for (const [label, pattern] of suppressionPatterns) {
      if (addedLines.some((line) => pattern.test(line))) {
        violations.push(`suppression directive added: ${label}`);
        suppressionDetected = true;
      }
    }
  }

  if (input.policy.max_diff_lines !== undefined) {
    const changedLineCount = diffResult.stdout
      .split("\n")
      .filter((line) => (line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---"))).length;
    if (changedLineCount > input.policy.max_diff_lines) {
      violations.push(`diff exceeds max_diff_lines: ${changedLineCount} > ${input.policy.max_diff_lines}`);
    }
  }

  const diffArtifact = `.dokion/evidence/${input.runId}/findings/${input.findingId}/repair.diff`;
  await writeTextAtomic(join(input.root, diffArtifact), diffResult.stdout);
  return {
    verdict: suppressionDetected ? "FIX_IS_SUPPRESSION" : violations.length > 0 ? "FIX_INCOMPLETE" : "FIX_HOLDS",
    violations,
    changedPaths,
    diffArtifact: relative(input.root, join(input.root, diffArtifact)),
    diffDigest: sha256(diffResult.stdout),
    diff: diffResult.stdout
  };
}
