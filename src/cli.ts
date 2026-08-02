#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { recordApproval } from "./approvals/approval-store.ts";
import { builtinCatalog } from "./catalog/builtin-catalog.ts";
import { renderCliHelp } from "./cli/command-registry.ts";
import { handleAuditCommand } from "./cli/handlers/audit.ts";
import { handleAutoRunnerCommand } from "./cli/handlers/auto-runner.ts";
import { handleAutopilotCommand } from "./cli/handlers/autopilot.ts";
import { handleCompareCommand } from "./cli/handlers/compare.ts";
import { handleConfigureCommand } from "./cli/handlers/configure.ts";
import { handleCreatorCommand } from "./cli/handlers/creator.ts";
import { handleDoctorCommand } from "./cli/handlers/doctor.ts";
import { handleGoalCommand } from "./cli/handlers/goal.ts";
import { handleHooksCommand } from "./cli/handlers/hooks.ts";
import { handleLoopCommand } from "./cli/handlers/loop.ts";
import { handleMemoryCommand } from "./cli/handlers/memory.ts";
import { handlePlan } from "./cli/handlers/plan.ts";
import { handlePlaybooksCommand } from "./cli/handlers/playbooks.ts";
import { handleResetCommand } from "./cli/handlers/reset.ts";
import { handleSkipCommand } from "./cli/handlers/skip.ts";
import { handleStepCommand } from "./cli/handlers/step.ts";
import { writeCliDiagnostic, writeCliResult } from "./cli/output.ts";
import { parseCliInvocation, requestedCliOutputFormat } from "./cli/parser.ts";
import { exitCodeForRunStatus } from "./cli/run-exit.ts";
import type { CliInvocation, CliOutputFormat } from "./cli/types.ts";
import { validateRepositoryContracts } from "./contracts/schema-validator.ts";
import { recoverAtomicWrites } from "./core/atomic-file.ts";
import { readJson } from "./core/json.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { listFindings } from "./findings/finding-store.ts";
import { inspectProject } from "./inspect/project-inspector.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { buildRegistryPackage } from "./registry/package-builder.ts";
import { pullRegistryPackage } from "./registry/pull-service.ts";
import { verifyRegistryPackage } from "./registry/package-verifier.ts";
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
  const key = kind === "plugins" ? "plugins_and_adapters" : kind;
  print(manifest.capability_catalog?.[key as "skills" | "tools" | "plugins_and_adapters" | "goals"] ?? [], format);
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
    case "configure":
      print(await handleConfigureCommand(root), invocation.format);
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
    case "registry":
      if (invocation.subcommand === "pack") {
        print(
          await buildRegistryPackage({
            sourceDirectory: invocation.directory,
            outputPath: invocation.output,
            overwrite: invocation.overwrite
          }),
          invocation.format
        );
        return;
      }
      if (invocation.subcommand === "pull") {
        print(
          await pullRegistryPackage({
            configPath: invocation.configPath,
            source: invocation.source,
            packageReference: invocation.packageReference,
            cacheRoot: invocation.cacheRoot
          }),
          invocation.format
        );
        return;
      }
      print(
        await verifyRegistryPackage({
          archivePath: invocation.archive,
          ...(invocation.expectedPackageId ? { expectedPackageId: invocation.expectedPackageId } : {}),
          ...(invocation.expectedVersion ? { expectedVersion: invocation.expectedVersion } : {})
        }),
        invocation.format
      );
      return;
    case "run": {
      const state = await new ExecutionEngine(root).run();
      print(state, invocation.format);
      process.exitCode = exitCodeForRunStatus(state.run.status);
      return;
    }
    case "step": {
      const store = new StateStore(root);
      const state = (await store.exists()) ? await store.load() : null;
      if (invocation.command === "step") {
        print(await handleStepCommand({ stepId: invocation.stepId, command: "step" }, state), invocation.format);
      }
      return;
    }
    case "resume": {
      const state = await new ExecutionEngine(root).resume();
      print(state, invocation.format);
      process.exitCode = exitCodeForRunStatus(state.run.status);
      return;
    }
    case "verify":
      await withProjectRunLock("verify", async () => validate(false, invocation.format));
      return;
    case "approve":
    case "reject":
      await decide(invocation);
      return;
    case "skip":
      if (invocation.command === "skip") {
        print(handleSkipCommand(invocation.stepId, invocation.reason, invocation.by ?? "user"), invocation.format);
      }
      return;
    case "reset":
      print(await handleResetCommand(root), invocation.format);
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
    case "audit":
      print(await handleAuditCommand(root), invocation.format);
      return;
    case "autopilot": {
      const store = new StateStore(root);
      const state = (await store.exists()) ? await store.load() : null;
      let playbook = { id: "default", name: "Default Playbook", steps: [] };
      try {
        const loaded = await loadActivePlaybook(root);
        playbook = loaded.data as any;
      } catch {}
      if (invocation.command === "autopilot") {
        print(await handleAutopilotCommand({
          playbook,
          state,
          ...(invocation.dryRun !== undefined ? { dryRun: invocation.dryRun } : {}),
          ...(invocation.maxTurns !== undefined ? { maxTurns: invocation.maxTurns } : {}),
        }), invocation.format);
      }
      return;
    }
    case "auto-runner": {
      if (invocation.command === "auto-runner") {
        const runnerReport = await handleAutoRunnerCommand(root, invocation);
        if (!runnerReport.completed) process.exitCode = 1;
      }
      return;
    }
    case "memory": {
      const exitCode = await handleMemoryCommand({
        subcommand: invocation.subcommand,
        targetDir: root,
        pattern: invocation.pattern,
        tool: invocation.tool,
        force: invocation.force,
        withLoop: invocation.withLoop,
        suggest: invocation.suggest,
        json: invocation.format === "json"
      });
      if (exitCode !== 0) process.exitCode = exitCode;
      return;
    }
    case "compare":
      print(await handleCompareCommand(root, { baselineRunId: invocation.baselineRunId, targetRunId: invocation.targetRunId }), invocation.format);
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
    case "playbooks": {
      const exitCode = await handlePlaybooksCommand([invocation.subcommand, ...(invocation.from ? ["--from", invocation.from] : [])], root);
      if (exitCode !== 0) process.exitCode = exitCode;
      return;
    }
    case "create": {
      await handleCreatorCommand({
        ...(invocation.fromMemory !== undefined ? { fromMemory: invocation.fromMemory } : {}),
        ...(invocation.transcript !== undefined ? { transcript: invocation.transcript } : {}),
        ...(invocation.topic !== undefined ? { topic: invocation.topic } : {}),
        ...(invocation.output !== undefined ? { output: invocation.output } : {}),
      });
      return;
    }
    case "hooks": {
      const exitCode = await handleHooksCommand([invocation.subcommand], root);
      if (exitCode !== 0) process.exitCode = exitCode;
      return;
    }
  }
}

try {
  await main();
} catch (error) {
  writeCliDiagnostic(error, requestedCliOutputFormat(process.argv.slice(2)));
  process.exitCode = 1;
}
