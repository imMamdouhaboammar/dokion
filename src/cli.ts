#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { renderCliResult, writeCliDiagnostic, writeCliResult } from "./cli/output.ts";
import { parseCliInvocation } from "./cli/parser.ts";
import { getCliCommandRegistry, resolveCliCommand } from "./cli/command-registry.ts";
import { handleAuditCommand } from "./cli/handlers/audit.ts";
import { handleAutoRunnerCommand } from "./cli/handlers/auto-runner.ts";
import { handleCompareCommand } from "./cli/handlers/compare.ts";
import { handleConfigureCommand } from "./cli/handlers/configure.ts";
import { handleCreatorCommand } from "./cli/handlers/creator.ts";
import { runDoctorAudit } from "./cli/handlers/doctor.ts";
import { handleHubCommand } from "./cli/handlers/hub.ts";
import { handleHooksCommand, handlePlaybooksCommand } from "./cli/handlers/playbook.ts";
import { handleResetCommand } from "./cli/handlers/reset.ts";
import { handleSkipCommand } from "./cli/handlers/skip.ts";
import { handleStepCommand } from "./cli/handlers/step.ts";
import { handleVerifyCommand } from "./cli/handlers/verify.ts";
import { DokionError } from "./core/errors.ts";
import { generateFullReport } from "./evidence/full-report.ts";
import { readAuditSummary } from "./evidence/independent-audit.ts";
import { exportFindingsAsJUnit } from "./evidence/junit.ts";
import { readPromotionSignoff } from "./evidence/promotion-signoff.ts";
import { exportFindingsAsSarif } from "./evidence/sarif.ts";
import { listFindings } from "./findings/finding-store.ts";
import { handleGoalCommand } from "./goal-engineering/command.ts";
import { listCatalog } from "./inventory/catalog.ts";
import { handleLoopCommand } from "./loop-engineering/command.ts";
import { handleMemoryCommand } from "./memory-engineering/command.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { buildExecutionPlan } from "./playbook/plan.ts";
import { listBuiltInPlaybooks } from "./playbook/registry.ts";
import { evaluateReadiness } from "./readiness/evaluator.ts";
import { generateReadinessStatement } from "./readiness/statement.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { inspectRepository } from "./repository/inspect.ts";
import { StateStore } from "./state/state-store.ts";
import { resetState } from "./state/reset.ts";
import { readCapabilityLock } from "./capability/lock.ts";
import { validateRepositoryContracts } from "./contracts/repository-contracts.ts";
import { handleApprovalCommand } from "./cli/handlers/approval.ts";

const root = process.cwd();

function print(value: unknown, format: "human" | "json"): void {
  process.stdout.write(`${renderCliResult(value, format)}\n`);
}

function printHelp(format: "human" | "json"): void {
  const commands = getCliCommandRegistry().filter((command) => command.implementation === "IMPLEMENTED");
  if (format === "json") {
    writeCliResult({ commands }, format);
    return;
  }

  console.log("Dokion CLI\n");
  console.log("Usage: dokion <command> [options]\n");
  for (const command of commands) {
    console.log(`  ${command.usage.padEnd(52)} ${command.description}`);
  }
  console.log("\nGlobal options:\n  --format human|json");
}

async function main(): Promise<void> {
  const invocation = parseCliInvocation(process.argv.slice(2));
  const command = resolveCliCommand(invocation.command);
  if (!command || command.implementation !== "IMPLEMENTED") {
    throw new DokionError("CLI_UNKNOWN_COMMAND", `Unknown command: ${invocation.command}`);
  }

  switch (invocation.command) {
    case "help":
      printHelp(invocation.format);
      return;
    case "init": {
      await mkdir(join(root, ".dokion"), { recursive: true });
      print({ initialized: true, project: basename(root) }, invocation.format);
      return;
    }
    case "inspect":
      print(await inspectRepository(root), invocation.format);
      return;
    case "doctor": {
      const result = await runDoctorAudit(root);
      print(result, invocation.format);
      if (!result.healthy) process.exitCode = 1;
      return;
    }
    case "plan": {
      const loaded = await loadActivePlaybook(root);
      print(await buildExecutionPlan(root, loaded.data), invocation.format);
      return;
    }
    case "validate": {
      const result = await validateRepositoryContracts(root, invocation.catalogOnly);
      print(result, invocation.format);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    case "run": {
      const state = await new ExecutionEngine(root).run();
      print(state, invocation.format);
      if (state.run.status !== "COMPLETED") process.exitCode = 1;
      return;
    }
    case "resume": {
      const state = await new ExecutionEngine(root).resume();
      print(state, invocation.format);
      if (state.run.status !== "COMPLETED") process.exitCode = 1;
      return;
    }
    case "verify":
      await handleVerifyCommand(root, invocation);
      return;
    case "approve":
    case "reject":
      await handleApprovalCommand(root, invocation.command, invocation.subject, invocation.by, invocation.reason, invocation.format);
      return;
    case "status": {
      const store = new StateStore(root);
      print(await store.load(), invocation.format);
      return;
    }
    case "report":
      print(await generateFullReport(root), invocation.format);
      return;
    case "findings":
      print(await listFindings(root), invocation.format);
      return;
    case "audit":
      await handleAuditCommand(root, invocation.format);
      return;
    case "compare":
      await handleCompareCommand(root, invocation);
      return;
    case "readiness": {
      const store = new StateStore(root);
      const state = await store.load();
      const result = await evaluateReadiness(root, state);
      print(result, invocation.format);
      if (!result.ready) process.exitCode = 1;
      return;
    }
    case "statement": {
      const store = new StateStore(root);
      const state = await store.load();
      print(await generateReadinessStatement(root, state), invocation.format);
      return;
    }
    case "signoff":
      print(await readPromotionSignoff(root), invocation.format);
      return;
    case "sarif":
      print(await exportFindingsAsSarif(root), invocation.format);
      return;
    case "junit":
      print(await exportFindingsAsJUnit(root), invocation.format);
      return;
    case "reset":
      await handleResetCommand(root, invocation.format);
      return;
    case "skip":
      await handleSkipCommand(root, invocation);
      return;
    case "step":
      await handleStepCommand(root, invocation);
      return;
    case "configure":
      await handleConfigureCommand(root, invocation);
      return;
    case "auto-runner":
      await handleAutoRunnerCommand(root, invocation);
      return;
    case "capabilities":
      print(await readCapabilityLock(root), invocation.format);
      return;
    case "playbook-list":
      print(listBuiltInPlaybooks(), invocation.format);
      return;
    case "tools":
    case "skills":
    case "plugins":
    case "loops":
      await listCatalog(invocation.command, invocation.format);
      return;
    case "memory":
      await handleMemoryCommand({ subcommand: invocation.subcommand, ...(invocation.pattern ? { pattern: invocation.pattern } : {}), format: invocation.format, projectDir: root });
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
    case "hub": {
      const output = await handleHubCommand(root, {
        ...(invocation.action !== undefined ? { action: invocation.action } : {}),
        ...(invocation.query !== undefined ? { query: invocation.query } : {}),
        ...(invocation.packageId !== undefined ? { packageId: invocation.packageId } : {}),
        ...(invocation.category !== undefined ? { category: invocation.category } : {}),
        format: invocation.format,
        ...(invocation.author !== undefined ? { author: invocation.author } : {}),
      });
      console.log(output);
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
  writeCliDiagnostic(
    error instanceof DokionError
      ? error
      : new DokionError("COMMAND_FAILED", error instanceof Error ? error.message : String(error)),
    parseCliInvocation(process.argv.slice(2), { tolerateErrors: true }).format
  );
  process.exitCode = 1;
}
