#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { recordApproval } from "./approvals/approval-store.ts";
import { builtinCatalog } from "./catalog/builtin-catalog.ts";
import { renderCliHelp } from "./cli/command-registry.ts";
import { handleDoctorCommand } from "./cli/handlers/doctor.ts";
import { handleGoalCommand } from "./cli/handlers/goal.ts";
import { handleLoopCommand } from "./cli/handlers/loop.ts";
import { handleMemoryCommand } from "./cli/handlers/memory.ts";
import { handlePlan } from "./cli/handlers/plan.ts";

import { writeCliDiagnostic, writeCliResult } from "./cli/output.ts";
import { parseCliInvocation, requestedCliOutputFormat } from "./cli/parser.ts";
import type { CliInvocation, CliOutputFormat } from "./cli/types.ts";
import { validateRepositoryContracts } from "./contracts/schema-validator.ts";
import { recoverAtomicWrites } from "./core/atomic-file.ts";
import { readJson } from "./core/json.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { listFindings } from "./findings/finding-store.ts";
import { inspectProject } from "./inspect/project-inspector.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { writeHardeningReport } from "./report/render-hardening.ts";
import { DOKION_VERSION } from "./runtime/package-metadata.ts";
import { acquireRunLock, type RunLockOperation } from "./state/run-lock.ts";
import { createRunId, StateStore } from "./state/state-store.ts";

const root = process.cwd();

function print(value: unknown, format: CliOutputFormat): void {
  writeCliResult(value, format);
}

async function withProjectRunLock<T>(operation: RunLockOperation, action: () => Promise<T>): Promise<T> {
  const store = new StateStore(root);
  let runId = createRunId();
  if (await store.exists()) {
    try {
      runId = (await store.load()).run.id;
    } catch {
      runId = createRunId();
    }
  }
  const lease = await acquireRunLock(root, { runId, operation });
  try {
    await recoverAtomicWrites(root);
    return await action();
  } finally {
    await lease.release();
  }
}

function help(format: CliOutputFormat): void {
  const content = renderCliHelp(DOKION_VERSION);
  if (format === "human") {
    console.log(content);
    return;
  }
  print({ version: DOKION_VERSION, usage: "dokion <command>", help: content }, format);
}

async function initialize(format: CliOutputFormat): Promise<void> {
  await recoverAtomicWrites(root);
  for (const path of [".dokion/findings", ".dokion/evidence", ".dokion/reports", ".dokion/runs"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  const store = new StateStore(root);
  let state;
  if (await store.exists()) {
    state = await store.load();
  } else {
    state = await store.initialize({ playbookDigest: "unconfigured", stages: [] });
    state = await store.update(state.revision, (current) => ({
      ...current,
      run: { ...current.run, status: "STOPPED", ended_at: new Date().toISOString() }
    }));
  }
  await writeHardeningReport(root, state);
  print({
    initialized: true,
    active_playbook_created: false,
    catalog: (await Bun.file(join(root, "dokion.json")).exists()) ? "project:dokion.json" : "builtin:dokion.json",
    state: ".dokion/state.json",
    report: "HARDENING.md",
    platform: state.profile?.platform,
    next: "Create or copy .dokion/playbook.json, pin every capability digest, then run dokion validate."
  }, format);
}

async function validate(catalogOnly: boolean, format: CliOutputFormat): Promise<void> {
  const summary = await validateRepositoryContracts(root);
  if (!summary.valid) {
    print(summary, format);
    process.exitCode = 1;
    return;
  }

  let activePlaybook;
  if (!catalogOnly) activePlaybook = await loadActivePlaybook(root);
  print({
    ...summary,
    ...(activePlaybook ? { active_playbook_digest: activePlaybook.digest } : {}),
    executable: catalogOnly ? undefined : true
  }, format);
}

async function status(format: CliOutputFormat): Promise<void> {
  const state = await new StateStore(root).load();
  print({
    run_id: state.run.id,
    status: state.run.status,
    playbook_digest: state.playbook.digest,
    platform: state.profile?.platform,
    degradations: state.run.degradations ?? [],
    approvals: state.approvals ?? [],
    stages: state.stages.map((stage) => ({
      id: stage.id,
      status: stage.status,
      steps: stage.steps.map((step) => ({ id: step.id, status: step.status, findings: step.findings ?? [] }))
    }))
  }, format);
}

async function report(format: CliOutputFormat): Promise<void> {
  const state = await new StateStore(root).load();
  await writeHardeningReport(root, state);
  print({ report: "HARDENING.md", run_id: state.run.id, status: state.run.status }, format);
}

interface DokionManifest {
  capability_catalog?: {
    skills?: unknown[];
    tools?: unknown[];
    plugins_and_adapters?: unknown[];
    goals?: unknown[];
  };
  loops?: { definitions?: unknown[] };
  goals?: { definitions?: unknown[] };
}

async function projectCatalog(): Promise<DokionManifest> {
  const path = join(root, "dokion.json");
  if (await Bun.file(path).exists()) return readJson<DokionManifest>(path);
  return builtinCatalog as DokionManifest;
}

async function listCatalog(kind: "skills" | "tools" | "plugins" | "loops" | "goals", format: CliOutputFormat): Promise<void> {
  const manifest = await projectCatalog();
  if (kind === "loops") {
    print(manifest.loops?.definitions ?? [], format);
    return;
  }
  if (kind === "goals") {
    print(manifest.goals?.definitions ?? manifest.capability_catalog?.goals ?? [], format);
    return;
  }
  const key = kind === "plugins" ? "plugins_and_adapters" : kind;
  print(manifest.capability_catalog?.[key] ?? [], format);
}

type DecisionInvocation = Extract<CliInvocation, { command: "approve" | "reject" }>;

async function decide(invocation: DecisionInvocation): Promise<void> {
  const record = await recordApproval(root, {
    subject: invocation.subject,
    subjectType: invocation.subjectType,
    decision: invocation.command === "approve" ? "APPROVED" : "REJECTED",
    by: invocation.by,
    ...(invocation.notes ? { notes: invocation.notes } : {})
  });
  const state = await new StateStore(root).load();
  await writeHardeningReport(root, state);
  print(record, invocation.format);
}

async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const invocation = parseCliInvocation(argv);

  switch (invocation.command) {
    case "help":
      help(invocation.format);
      return;
    case "init":
      await initialize(invocation.format);
      return;
    case "inspect":
      print(await inspectProject(root), invocation.format);
      return;
    case "doctor": {
      const audit = await handleDoctorCommand(root);
      print(audit, invocation.format);
      if (!audit.healthy) process.exitCode = 1;
      return;
    }
    case "plan":
      print(await handlePlan(root), invocation.format);
      return;
    case "validate":
      await validate(invocation.catalogOnly, invocation.format);
      return;
    case "run":
      print(await new ExecutionEngine(root).run(), invocation.format);
      return;
    case "resume":
      print(await new ExecutionEngine(root).resume(), invocation.format);
      return;
    case "verify":
      await withProjectRunLock("verify", async () => validate(false, invocation.format));
      return;
    case "approve":
    case "reject":
      await decide(invocation);
      return;
    case "status":
      await status(invocation.format);
      return;
    case "report":
      await report(invocation.format);
      return;
    case "findings":
      print(await listFindings(root), invocation.format);
      return;
    case "tools":
      await listCatalog("tools", invocation.format);
      return;
    case "skills":
      await listCatalog("skills", invocation.format);
      return;
    case "plugins":
      await listCatalog("plugins", invocation.format);
      return;
    case "loops":
      await listCatalog("loops", invocation.format);
      return;
    case "loop":
      print(handleLoopCommand({ subcommand: invocation.subcommand, ...(invocation.pattern ? { pattern: invocation.pattern } : {}), format: invocation.format, projectDir: root }), invocation.format);
      return;
    case "goals":
      await listCatalog("goals", invocation.format);
      return;
    case "goal":
      print(
        handleGoalCommand({
          subcommand: invocation.subcommand,
          ...(invocation.pattern ? { pattern: invocation.pattern } : {}),
          ...(invocation.level ? { level: invocation.level } : {}),
          ...(invocation.objective ? { objective: invocation.objective } : {}),
          format: invocation.format,
          projectDir: root,
        }),
        invocation.format
      );
      return;
    case "memory":
      process.exitCode = await handleMemoryCommand({
        subcommand: invocation.subcommand,
        targetDir: invocation.targetDir || root,
        ...(invocation.pattern ? { pattern: invocation.pattern } : {}),
        ...(invocation.tool ? { tool: invocation.tool } : {}),
        ...(invocation.force !== undefined ? { force: invocation.force } : {}),
        ...(invocation.withLoop !== undefined ? { withLoop: invocation.withLoop } : {}),
        ...(invocation.suggest !== undefined ? { suggest: invocation.suggest } : {}),
        json: invocation.format === "json"
      });
      return;

  }
}


try {
  await main();
} catch (error) {
  writeCliDiagnostic(error, requestedCliOutputFormat(process.argv.slice(2)));
  process.exitCode = 1;
}
