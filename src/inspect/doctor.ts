import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  detectCapabilityConflicts,
  type CapabilityDeclaration
} from "../capability/conflict-detector.ts";
import { checkEnvironmentPrerequisites } from "../capability/environment-check.ts";
import { validateRepositoryContracts } from "../contracts/schema-validator.ts";
import { detectAgentPlatform } from "../platform/platform-detector.ts";
import type { AgentPlatform, PlatformProfile } from "../platform/types.ts";
import { loadActivePlaybook } from "../playbook/load-playbook.ts";
import type { DokionPlaybook } from "../playbook/types.ts";

export type DoctorCheckStatus = "PASS" | "WARN" | "FAIL";

export interface DoctorCheck {
  id: string;
  category: "runtime" | "repository" | "platform" | "capability" | "environment" | "conflict";
  status: DoctorCheckStatus;
  blocking: boolean;
  detail: string;
}

export interface DoctorAuditReport {
  schema_version: 1;
  healthy: boolean;
  platform: PlatformProfile;
  summary: { pass: number; warn: number; fail: number };
  checks: DoctorCheck[];
}

export interface DoctorAuditOptions {
  environment?: Record<string, string | undefined>;
  which?: (command: string) => string | null;
}

interface LockVersion {
  version?: string;
  digest?: string;
}

interface LockEntry {
  id: string;
  trust_status?: string;
  platforms?: AgentPlatform[];
  source?: { kind?: string; path?: string; commit?: string };
  versions?: LockVersion[];
  required_permissions?: { env?: string[] };
  installation?: { method?: string; command?: string };
  installer_exception?: {
    reason?: string;
    approved_by?: string;
    documented_at?: string;
    approved_at?: string;
    used_installer?: string;
  };
  verification?: { availability_command?: string; digest_check?: boolean };
  selected_in_playbook_steps?: string[];
  executablePath?: string;
  digest?: string;
  version?: string;
}

interface CapabilityLockData {
  capabilities: LockEntry[];
}

function check(
  id: string,
  category: DoctorCheck["category"],
  status: DoctorCheckStatus,
  detail: string
): DoctorCheck {
  return { id, category, status, blocking: status === "FAIL", detail };
}

function safeErrorDetail(prefix: string, error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "UNKNOWN";
  return `${prefix}: ${code}`;
}

function normalizeLock(data: unknown): CapabilityLockData | undefined {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return undefined;
  const value = data as Record<string, unknown>;
  if (Array.isArray(value.capabilities)) {
    return { capabilities: value.capabilities.filter((entry): entry is LockEntry =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof (entry as LockEntry).id === "string") };
  }
  if (typeof value.capabilities === "object" && value.capabilities !== null) {
    const capabilities = Object.entries(value.capabilities as Record<string, unknown>).flatMap(([id, entry]) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
      const legacy = entry as Record<string, unknown>;
      return [{
        id,
        ...(typeof legacy.executablePath === "string" ? { executablePath: legacy.executablePath } : {}),
        ...(typeof legacy.digest === "string" ? { digest: legacy.digest } : {}),
        ...(typeof legacy.version === "string" ? { version: legacy.version } : {}),
        trust_status: "VERIFIED"
      } satisfies LockEntry];
    });
    return { capabilities };
  }
  return undefined;
}

function lockById(lock: CapabilityLockData | undefined): Map<string, LockEntry> {
  return new Map((lock?.capabilities ?? []).map((entry) => [entry.id, entry] as const));
}

function supportedPlatforms(stepPlatforms: Record<string, string> | undefined, lock: LockEntry | undefined): AgentPlatform[] | undefined {
  if (stepPlatforms !== undefined) {
    return Object.keys(stepPlatforms).filter((value): value is AgentPlatform =>
      value === "claude_code" || value === "codex" || value === "gemini_cli" || value === "other");
  }
  return lock?.platforms;
}

function declarations(playbook: DokionPlaybook, lock: CapabilityLockData | undefined): CapabilityDeclaration[] {
  const locks = lockById(lock);
  return playbook.stages.flatMap((stage) => stage.steps.map((step) => {
    const platforms = supportedPlatforms(step.capability.platforms, locks.get(step.capability.id));
    return {
      id: step.capability.id,
      stepId: step.id,
      stageId: stage.id,
      stageExecution: stage.execution ?? "SEQUENTIAL",
      responsibility: step.responsibility,
      ...(step.capability.version ? { version: step.capability.version } : {}),
      writeScopes: step.permissions?.write ?? [],
      ...(platforms ? { platforms } : {})
    };
  }));
}

function environmentNames(playbook: DokionPlaybook | undefined, lock: CapabilityLockData | undefined): string[] {
  const fromPlaybook = playbook?.stages.flatMap((stage) =>
    stage.steps.flatMap((step) => step.permissions?.env ?? [])) ?? [];
  const fromLock = lock?.capabilities.flatMap((entry) => entry.required_permissions?.env ?? []) ?? [];
  return [...new Set([...fromPlaybook, ...fromLock])].sort();
}

function firstCommandToken(command: string | undefined): string | undefined {
  if (!command) return undefined;
  const token = command.trim().split(/\s+/, 1)[0];
  return token && /^[A-Za-z0-9._/-]+$/.test(token) ? token : undefined;
}

function insideRoot(root: string, candidate: string): boolean {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function resolveExecutablePath(
  root: string,
  entry: LockEntry,
  which: (command: string) => string | null
): Promise<string | undefined> {
  const configured = entry.executablePath ?? entry.source?.path ?? firstCommandToken(entry.verification?.availability_command);
  if (!configured) return undefined;
  if (isAbsolute(configured)) return (await Bun.file(configured).exists()) ? configured : undefined;
  if (configured.includes("/") || configured.startsWith(".")) {
    const candidate = resolve(root, configured);
    if (!insideRoot(root, candidate)) return undefined;
    return (await Bun.file(candidate).exists()) ? candidate : undefined;
  }
  return which(configured) ?? undefined;
}

async function digestFile(path: string, algorithm: "sha256" | "sha512"): Promise<string> {
  const content = await readFile(path);
  return `${algorithm}:${createHash(algorithm).update(content).digest("hex")}`;
}

function declaredCapabilityData(playbook: DokionPlaybook): Map<string, Array<{
  stepId: string;
  version?: string;
  immutableReference?: string;
}>> {
  const result = new Map<string, Array<{ stepId: string; version?: string; immutableReference?: string }>>();
  for (const stage of playbook.stages) {
    for (const step of stage.steps) {
      const values = result.get(step.capability.id) ?? [];
      values.push({
        stepId: step.id,
        ...(step.capability.version ? { version: step.capability.version } : {}),
        ...(step.capability.immutable_reference
          ? { immutableReference: step.capability.immutable_reference }
          : {})
      });
      result.set(step.capability.id, values);
    }
  }
  return result;
}

function expectedDigest(entry: LockEntry, declaredVersion: string | undefined): string | undefined {
  const matched = declaredVersion
    ? entry.versions?.find((version) => version.version === declaredVersion)
    : entry.versions?.[0];
  return matched?.digest ?? entry.digest;
}

function provenanceCheck(id: string, entry: LockEntry): DoctorCheck {
  const method = entry.installation?.method;
  const hasIdentity = Boolean(entry.source?.kind && (entry.versions?.length || entry.digest));
  if (!method || !hasIdentity) {
    return check(
      `capability:${id}:provenance`,
      "capability",
      "FAIL",
      `Capability ${id} lacks complete package or source provenance`
    );
  }

  if (method !== "package_manager") {
    return check(
      `capability:${id}:provenance`,
      "capability",
      "PASS",
      `Capability ${id} records ${method} provenance`
    );
  }

  const installer = firstCommandToken(entry.installation?.command);
  if (installer === "bun") {
    return check(
      `capability:${id}:provenance`,
      "capability",
      "PASS",
      `Capability ${id} records Bun package provenance`
    );
  }

  const exception = entry.installer_exception;
  const approvalTime = exception?.documented_at ?? exception?.approved_at;
  const approved = Boolean(
    installer
    && exception?.reason?.trim()
    && exception.approved_by?.trim()
    && approvalTime
    && !Number.isNaN(Date.parse(approvalTime))
  );
  return check(
    `capability:${id}:provenance`,
    "capability",
    approved ? "PASS" : "FAIL",
    approved
      ? `Capability ${id} records an approved non-Bun installer exception`
      : `Capability ${id} uses a non-Bun installer without a complete approval record`
  );
}

async function capabilityChecks(
  root: string,
  playbook: DokionPlaybook,
  lock: CapabilityLockData | undefined,
  which: (command: string) => string | null
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const entries = lockById(lock);
  for (const [id, declarations] of declaredCapabilityData(playbook)) {
    const entry = entries.get(id);
    if (!entry) {
      checks.push(check(
        `capability:${id}:lock-entry`,
        "capability",
        "FAIL",
        `Declared capability ${id} has no verified lock entry`
      ));
      continue;
    }

    checks.push(check(
      `capability:${id}:trust`,
      "capability",
      entry.trust_status === "VERIFIED" ? "PASS" : "FAIL",
      entry.trust_status === "VERIFIED"
        ? `Capability ${id} trust status is verified`
        : `Capability ${id} trust status is not verified`
    ));

    const declaredVersions = [...new Set(declarations.flatMap((value) => value.version ? [value.version] : []))].sort();
    const lockedVersions = new Set((entry.versions ?? []).flatMap((value) => value.version ? [value.version] : []));
    if (entry.version) lockedVersions.add(entry.version);
    const versionsMatch = declaredVersions.every((version) => lockedVersions.has(version));
    checks.push(check(
      `capability:${id}:version`,
      "capability",
      versionsMatch ? "PASS" : "FAIL",
      versionsMatch
        ? `Capability ${id} version declarations match the lock`
        : `Capability ${id} version declarations do not match the lock`
    ));

    const executable = await resolveExecutablePath(root, entry, which);
    checks.push(check(
      `capability:${id}:availability`,
      "capability",
      executable ? "PASS" : "FAIL",
      executable
        ? `Capability ${id} resolved to an available executable or source path`
        : `Capability ${id} is not available at its declared path`
    ));

    const declaredVersion = declarations.find((value) => value.version)?.version;
    const lockedDigest = expectedDigest(entry, declaredVersion);
    const immutableReferences = [...new Set(declarations.flatMap((value) =>
      value.immutableReference ? [value.immutableReference] : []))];
    let digestMatches = Boolean(lockedDigest && executable);
    if (digestMatches && immutableReferences.length > 0) {
      digestMatches = immutableReferences.every((reference) => reference === lockedDigest);
    }
    if (digestMatches && lockedDigest && executable) {
      const algorithm = lockedDigest.startsWith("sha512:") ? "sha512" : "sha256";
      if (!lockedDigest.startsWith(`${algorithm}:`)) {
        digestMatches = false;
      } else {
        try {
          digestMatches = await digestFile(executable, algorithm) === lockedDigest;
        } catch {
          digestMatches = false;
        }
      }
    }
    checks.push(check(
      `capability:${id}:digest`,
      "capability",
      digestMatches ? "PASS" : "FAIL",
      digestMatches
        ? `Capability ${id} digest matches the lock and playbook`
        : `Capability ${id} digest could not be verified against the lock and playbook`
    ));
    checks.push(provenanceCheck(id, entry));
  }
  return checks;
}

export async function runDoctorAudit(
  root: string,
  options: DoctorAuditOptions = {}
): Promise<DoctorAuditReport> {
  const environment = options.environment ?? process.env;
  const which = options.which ?? ((command: string) => Bun.which(command));
  const platform = detectAgentPlatform(environment);
  const checks: DoctorCheck[] = [];
  const gitAvailable = Boolean(which("git"));
  const pythonAvailable = Boolean(which("python3"));

  checks.push(check("runtime:bun", "runtime", "PASS", `Bun ${Bun.version} is available`));
  checks.push(check(
    "runtime:git",
    "runtime",
    gitAvailable ? "PASS" : "FAIL",
    gitAvailable ? "Git is available" : "Git is unavailable"
  ));
  checks.push(check(
    "runtime:python3",
    "runtime",
    pythonAvailable ? "PASS" : "WARN",
    pythonAvailable ? "Python 3 is available" : "Python 3 is unavailable for optional schema tooling"
  ));

  const playbookExists = await Bun.file(join(root, ".dokion/playbook.json")).exists();
  const stateExists = await Bun.file(join(root, ".dokion/state.json")).exists();
  const lockPath = join(root, ".dokion/capabilities.lock.json");
  const lockExists = await Bun.file(lockPath).exists();
  let playbook: DokionPlaybook | undefined;
  let lock: CapabilityLockData | undefined;
  let contractsValid = false;

  if (playbookExists) {
    try {
      playbook = (await loadActivePlaybook(root)).data;
      checks.push(check(
        "repository:active-playbook",
        "repository",
        "PASS",
        "The active playbook is valid and pinned"
      ));
    } catch (error) {
      checks.push(check(
        "repository:active-playbook",
        "repository",
        "FAIL",
        safeErrorDetail("The active playbook is invalid", error)
      ));
    }
  } else {
    checks.push(check(
      "repository:active-playbook",
      "repository",
      "WARN",
      "No active playbook is configured"
    ));
  }

  checks.push(check(
    "repository:state",
    "repository",
    stateExists ? "PASS" : "WARN",
    stateExists ? "Dokion state is present" : "Dokion state has not been initialized"
  ));

  if (lockExists) {
    try {
      lock = normalizeLock(JSON.parse(await readFile(lockPath, "utf8")));
      checks.push(check(
        "capability-lock:presence",
        "capability",
        lock ? "PASS" : "FAIL",
        lock ? "The capability lock is present" : "The capability lock structure is unsupported"
      ));
    } catch {
      checks.push(check(
        "capability-lock:presence",
        "capability",
        "FAIL",
        "The capability lock is not valid JSON"
      ));
    }
  } else {
    checks.push(check(
      "capability-lock:presence",
      "capability",
      playbookExists ? "FAIL" : "WARN",
      playbookExists
        ? "The active playbook has no capability lock"
        : "No capability lock exists before playbook activation"
    ));
  }

  try {
    const contracts = await validateRepositoryContracts(root);
    contractsValid = contracts.valid;
    checks.push(check(
      "repository:contracts",
      "repository",
      contracts.valid ? "PASS" : "FAIL",
      contracts.valid
        ? `Repository contracts are valid across ${contracts.checkedFiles.length} files`
        : `Repository contracts contain ${contracts.errors.length} validation issues`
    ));
  } catch (error) {
    checks.push(check(
      "repository:contracts",
      "repository",
      "FAIL",
      safeErrorDetail("Repository contracts could not be validated", error)
    ));
  }

  if (!contractsValid && lockExists) lock = undefined;

  for (const result of checkEnvironmentPrerequisites(
    environmentNames(playbook, lock).map((name) => ({ name, required: true })),
    environment
  ).checks) {
    checks.push(check(
      `environment:${result.name}`,
      "environment",
      result.status === "PASS" ? "PASS" : "FAIL",
      result.status === "PASS"
        ? `Declared environment prerequisite ${result.name} is satisfied`
        : `Declared environment prerequisite ${result.name} failed: ${result.reason ?? result.status}`
    ));
  }

  if (playbook) {
    for (const conflict of detectCapabilityConflicts(declarations(playbook, lock), platform.agent)) {
      checks.push(check(
        `conflict:${conflict.type}:${conflict.stepIds.join(",")}`,
        "conflict",
        "FAIL",
        conflict.detail
      ));
    }
    checks.push(...await capabilityChecks(root, playbook, lock, which));
  }

  for (const degradation of platform.degradations) {
    checks.push(check(
      `platform:degradation:${degradation}`,
      "platform",
      "WARN",
      `Platform guarantee is reduced: ${degradation}`
    ));
  }

  checks.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const summary = {
    pass: checks.filter((item) => item.status === "PASS").length,
    warn: checks.filter((item) => item.status === "WARN").length,
    fail: checks.filter((item) => item.status === "FAIL").length
  };
  return {
    schema_version: 1,
    healthy: summary.fail === 0,
    platform,
    summary,
    checks
  };
}

export type CapabilityAuditReport = DoctorAuditReport;

export async function runCapabilityAudit(root = process.cwd()): Promise<DoctorAuditReport> {
  return runDoctorAudit(root);
}
