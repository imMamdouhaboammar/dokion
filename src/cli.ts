#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { recordApproval, type ApprovalSubjectType } from "./approvals/approval-store.ts";
import { validateRepositoryContracts } from "./contracts/schema-validator.ts";
import { DokionError } from "./core/errors.ts";
import { readJson } from "./core/json.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { listFindings } from "./findings/finding-store.ts";
import { inspectProject } from "./inspect/project-inspector.ts";
import { detectAgentPlatform } from "./platform/platform-detector.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { writeHardeningReport } from "./report/render-hardening.ts";
import { StateStore } from "./state/state-store.ts";

const root = process.cwd();
const [command = "help", ...args] = process.argv.slice(2);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function optionValue(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function help(): void {
  console.log(`Dokion 0.3.0\n\nUsage: dokion <command>\n\nObserve:\n  inspect\n  doctor\n  status\n  findings\n  report\n  tools list\n  skills list\n  plugins list\n  loops list\n\nConfigure:\n  init\n  validate [--catalog-only]\n\nExecute:\n  run\n  resume\n  verify\n  approve <step:id|finding:id> --by <identity> [--notes <text>]\n  reject <step:id|finding:id> --by <identity> [--notes <text>]\n\nDokion never installs, selects, substitutes, reorders, or enables capabilities.`);
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

async function listCatalog(kind: "skills" | "tools" | "plugins" | "loops"): Promise<void> {
  const manifest = await readJson<DokionManifest>(join(root, "dokion.json"));
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
    python3: Bun.which("python3") ?? null,
    active_playbook: await Bun.file(join(root, ".dokion/playbook.json")).exists(),
    state: await Bun.file(join(root, ".dokion/state.json")).exists()
  };
  print({ checks, platform, healthy: Boolean(checks.git && checks.python3) });
}

function inferSubjectType(subject: string): ApprovalSubjectType {
  const prefix = subject.split(":", 1)[0];
  const supported: ApprovalSubjectType[] = ["step", "finding", "fix", "commit", "install", "suggestion", "deferral"];
  if (!supported.includes(prefix as ApprovalSubjectType)) {
    throw new Error(`Unsupported approval subject: ${subject}`);
  }
  return prefix as ApprovalSubjectType;
}

async function decide(decision: "APPROVED" | "REJECTED"): Promise<void> {
  const subject = args[0];
  const by = optionValue("--by");
  const notes = optionValue("--notes");
  if (!subject || !by) {
    throw new Error(`Usage: dokion ${decision === "APPROVED" ? "approve" : "reject"} <subject> --by <identity> [--notes <text>]`);
  }
  const record = await recordApproval(root, {
    subject,
    subjectType: inferSubjectType(subject),
    decision,
    by,
    ...(notes ? { notes } : {})
  });
  const state = await new StateStore(root).load();
  await writeHardeningReport(root, state);
  print(record);
}

async function main(): Promise<void> {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
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
      await validate(args.includes("--catalog-only"));
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
      await decide("APPROVED");
      return;
    case "reject":
      await decide("REJECTED");
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
      if (args[0] !== "list") throw new Error("Usage: dokion tools list");
      await listCatalog("tools");
      return;
    case "skills":
      if (args[0] !== "list") throw new Error("Usage: dokion skills list");
      await listCatalog("skills");
      return;
    case "plugins":
      if (args[0] !== "list") throw new Error("Usage: dokion plugins list");
      await listCatalog("plugins");
      return;
    case "loops":
      if (args[0] !== "list") throw new Error("Usage: dokion loops list");
      await listCatalog("loops");
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
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
