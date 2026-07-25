#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface HookInput {
  cwd?: string;
  [key: string]: unknown;
}

interface StoredState {
  run?: { status?: string };
  playbook?: { digest?: string; path?: string };
}

export interface GuardResult {
  allow: boolean;
  reason?: string;
  expected?: string;
  observed?: string;
}

const ACTIVE_PLAYBOOK_PATH = ".dokion/playbook.json";

function sha256(content: Uint8Array): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function evaluatePlaybookGuard(root: string): Promise<GuardResult> {
  const statePath = join(root, ".dokion", "state.json");
  const playbookPath = join(root, ACTIVE_PLAYBOOK_PATH);
  if (!(await exists(statePath)) || !(await exists(playbookPath))) return { allow: true };

  let state: StoredState;
  try {
    state = JSON.parse(await readFile(statePath, "utf8")) as StoredState;
  } catch {
    return { allow: false, reason: "PLAYBOOK_TAINTED: Dokion state is unreadable or invalid JSON." };
  }

  const activeStatuses = new Set(["RUNNING", "AWAITING_USER"]);
  if (!activeStatuses.has(state.run?.status ?? "")) return { allow: true };

  const expected = state.playbook?.digest;
  if (!expected || !expected.startsWith("sha256:")) return { allow: true };

  const declaredPath = state.playbook?.path ?? ACTIVE_PLAYBOOK_PATH;
  if (declaredPath !== ACTIVE_PLAYBOOK_PATH) {
    return {
      allow: false,
      reason: `PLAYBOOK_TAINTED: State contains a noncanonical playbook path: ${declaredPath}`,
      expected
    };
  }

  try {
    const stat = await lstat(playbookPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        allow: false,
        reason: `PLAYBOOK_TAINTED: Active playbook must be a regular file at ${ACTIVE_PLAYBOOK_PATH}.`,
        expected
      };
    }
  } catch (error) {
    if (missing(error)) {
      return { allow: false, reason: `PLAYBOOK_TAINTED: Active playbook is missing at ${ACTIVE_PLAYBOOK_PATH}.`, expected };
    }
    return { allow: false, reason: `PLAYBOOK_TAINTED: Active playbook metadata could not be read.`, expected };
  }

  const observed = sha256(await readFile(playbookPath));
  if (observed !== expected) {
    return {
      allow: false,
      reason: `PLAYBOOK_TAINTED: Active playbook changed during the run. Expected ${expected}, observed ${observed}.`,
      expected,
      observed
    };
  }
  return { allow: true, expected, observed };
}

async function readHookInput(): Promise<HookInput> {
  const raw = await new Response(Bun.stdin.stream()).text();
  if (!raw.trim()) return {};
  return JSON.parse(raw) as HookInput;
}

async function main(): Promise<void> {
  let input: HookInput;
  try {
    input = await readHookInput();
  } catch {
    console.error("PLAYBOOK_TAINTED: Claude hook input was not valid JSON.");
    process.exit(2);
  }

  const root = resolve(input.cwd ?? process.cwd());
  const result = await evaluatePlaybookGuard(root);
  if (!result.allow) {
    console.error(result.reason ?? "PLAYBOOK_TAINTED: Playbook integrity check failed.");
    process.exit(2);
  }
}

if (import.meta.main) await main();
