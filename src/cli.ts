#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { recordApproval } from "./approvals/approval-store.ts";
import { builtinCatalog } from "./catalog/builtin-catalog.ts";
import { renderCliHelp } from "./cli/command-registry.ts";
import { parseCliInvocation } from "./cli/parser.ts";
import type { CliInvocation } from "./cli/types.ts";
import { validateRepositoryContracts } from "./contracts/schema-validator.ts";
import { DokionError } from "./core/errors.ts";
import { readJson } from "./core/json.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { listFindings } from "./findings/finding-store.ts";
import { inspectProject } from "./inspect/project-inspector.ts";
import { detectAgentPlatform } from "./platform/platform-detector.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { writeHardeningReport } from "./report/render-hardening.ts";
import { DOKION_VERSION } from "./runtime/package-metadata.ts";
import { StateStore } from "./state/state-store.ts";

const root = process.cwd();

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function help(): void {
  console.log(renderCliHelp(DOKION_VERSION));
}

async function initialize(): Promise<void> {
  for (const path of [".dokion/findings", ".dokion/evidence", ".dokion/reports", ".dokion/runs"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  const store = new StateStore(root);
  let state;
  if (await store.exists()) {
    state = await store.load();
  } else {
    state = await store.initialize({ playbookDigest: "unconfigured", stages: [] });
    state = await store.update((current) => ({
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
  });
}

async function validate(catalogOnly: boolean): Promise<void> {
  const summary = await validateRepositoryContracts(root);
  if (!summary.valid) {
    print(summary);
    process.exitCode = 1;
    return;
  }

  let activePlaybook;
  if (!catalogOnly) activePlaybook = await loadActivePlaybook(root);
  print({
    ...summary,
    ...(activePlaybook ? { active_playbook_digest: activePlaybook.digest } : {}),
    executable: catalogOnly ? undefined : true
  });
}

async function status(): Promise<void> {
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
  });
}

async function report(): Promise<void> {
  const state = await new StateStore(root).load();
  await writeHardeningReport(root, state);
  print({ report: "HARDENING.md", run_id: state.run.id, status: state.run.status });
}

interface DokionManifest {
  capability_catalog?: {
    skills?: unknown[];
    tools?: unknown[];
    plugins_and_adapters?: unknown[];
  };
  loops?: { definitions?: unknown[] };
}

async function projectCatalog(): Promise<DokionManifest> {
  const path = join(root, "dokion.json");
  if (await Bun.file(path).exists()) return readJson<DokionManifest>(path);
  return builtinCatalog as DokionManifest;
}

async function listCatalog(kind: "skills" | "tools" | "plugins" | "loops"): Promise<void> {
  const manifest = await projectCatalog();
  if (kind === "loops") {
    print(manifest.loops?.definitions ?? []);
    return;
  }
  const key = kind === "plugins" ? "plugins_and_adapters" : kind;
  print(manifest.capability_catalog?.[key] ?? []);
}

async function doctor(): Promise<void> {
  const platform = detectAgentPlatform();
  const checks = {
    bun: Bun.version,
    git: Bun.which("git") ?? null,
    python3_optional: Bun.which("python3") ?? null,
    active_playbook: await Bun.file(join(root, ".dokion/playbook.json")).exists(),
    state: await Bun.file(join(root, ".dokion/state.json")).exists(),
    catalog: (await Bun.file(join(root, "dokion.json")).exists()) ? "project:dokion.json" : "builtin:dokion.json"
  };
  print({ checks, platform, healthy: Boolean(checks.git) });
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
  print(record);
}

async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const invocation = parseCliInvocation(argv);

  switch (invocation.command) {
    case "help":
      help();
      return;
    case "init":
      await initialize();
      return;
    case "inspect":
      print(await inspectProject(root));
      return;
    case "doctor":
      await doctor();
      return;
    case "validate":
      await validate(invocation.catalogOnly);
      return;
    case "run":
      print(await new ExecutionEngine(root).run());
      return;
    case "resume":
      print(await new ExecutionEngine(root).resume());
      return;
    case "verify":
      await validate(false);
      return;
    case "approve":
    case "reject":
      await decide(invocation);
      return;
    case "status":
      await status();
      return;
    case "report":
      await report();
      return;
    case "findings":
      print(await listFindings(root));
      return;
    case "tools":
      await listCatalog("tools");
      return;
    case "skills":
      await listCatalog("skills");
      return;
    case "plugins":
      await listCatalog("plugins");
      return;
    case "loops":
      await listCatalog("loops");
      return;
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof DokionError) {
    console.error(JSON.stringify({ error: error.code, message: error.message, details: error.details }, null, 2));
  } else {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
  process.exitCode = 1;
}
