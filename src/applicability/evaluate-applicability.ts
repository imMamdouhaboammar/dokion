import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { ProjectProfile } from "../inspect/project-inspector.ts";
import type { Applicability, DokionPlatform } from "../playbook/types.ts";

export interface ApplicabilityResult {
  applicable: boolean;
  reason: string;
}

async function literalPathExists(root: string, pattern: string): Promise<boolean> {
  try {
    await stat(join(root, pattern));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?\[\]{}]/.test(pattern);
}

async function pathPatternMatches(root: string, pattern: string): Promise<boolean> {
  if (!containsGlobSyntax(pattern)) return literalPathExists(root, pattern);

  const glob = new Bun.Glob(pattern);
  for await (const _path of glob.scan({ cwd: root })) {
    return true;
  }
  return false;
}

function profileValueMatches(actual: unknown, expected: boolean | string | unknown[]): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every((value) => actual.includes(value));
  }
  return actual === expected;
}

export function detectPlatform(environment: NodeJS.ProcessEnv = process.env): DokionPlatform {
  const configured = environment.DOKION_AGENT;
  if (configured === "claude_code" || configured === "codex" || configured === "gemini_cli") {
    return configured;
  }
  return "other";
}

export async function evaluateApplicability(input: {
  root: string;
  platform: DokionPlatform;
  profile: ProjectProfile | Record<string, unknown>;
  applicability: Applicability | undefined;
}): Promise<ApplicabilityResult> {
  const applicability = input.applicability;
  if (!applicability) {
    return { applicable: true, reason: "no applicability constraints declared" };
  }

  for (const pattern of applicability.when_paths_exist ?? []) {
    if (!(await pathPatternMatches(input.root, pattern))) {
      return { applicable: false, reason: `required path pattern has no match: ${pattern}` };
    }
  }

  for (const pattern of applicability.when_paths_absent ?? []) {
    if (await pathPatternMatches(input.root, pattern)) {
      return { applicable: false, reason: `forbidden path pattern matched: ${pattern}` };
    }
  }

  if (applicability.when_platform && !applicability.when_platform.includes(input.platform as Exclude<DokionPlatform, "other">)) {
    return { applicable: false, reason: `platform ${input.platform} is not declared applicable` };
  }

  const profileValues = input.profile as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(applicability.when_profile ?? {})) {
    const actual = profileValues[key];
    if (!profileValueMatches(actual, expected)) {
      return { applicable: false, reason: `profile mismatch: ${key}` };
    }
  }

  return { applicable: true, reason: "all declared applicability conditions matched" };
}
