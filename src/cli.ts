#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { validateRepositoryContracts } from "./contracts/schema-validator.ts";
import { DokionError } from "./core/errors.ts";
import { readJson } from "./core/json.ts";
import { ExecutionEngine } from "./engine/execution-engine.ts";
import { inspectProject } from "./inspect/project-inspector.ts";
import { loadActivePlaybook } from "./playbook/load-playbook.ts";
import { writeHardeningReport } from "./report/render-hardening.ts";
import { StateStore } from "./state/state-store.ts";

const root = process.cwd();
const [command = "help", ...args] = process.argv.slice(2);

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function help(): void {
  console.log(`Dokion 0.1.0\n\nUsage: dokion <command>\n\nObserve:\n  inspect\n  doctor\n  status\n  findings\n  report\n  tools list\n  skills list\n  plugins list\n  loops list\n\nConfigure:\n  init\n  validate [--catalog-only]\n\nExecute:\n  run\n  resume\n  verify\n\nDokion never installs, selects, substitutes, reorders, or enables capabilities.`);
}

async function initialize(): Promise<void> {
  for (const path of [
    ".dokion/findings",
    ".dokion/evidence",
    ".dokion/reports",
    ".dokion/runs"
  ]) {
    await mkdir(join(root, path), { recursive: true });
  }

  const store = new StateStore(root);
  let state;
  if (await store.exists()) {
    state = await store.load();
  } else {
    state = await store.initialize({
      playbookDigest: "unconfigured",
      agent: "other",
      stages: []
    });
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
  if (!catalogOnly) {
    activePlaybook = await loadActivePlaybook(root);
  }

  print({
    ...summary,
    ...(activePlaybook ? { active_playbook_digest: activePlaybook.digest } : {}),
    executable: catalogOnly ? undefined : true
  });
}

async function status(): Promise<void> {
  const store = new StateStore(root);
  const state = await store.load();
  print({
    run_id: state.run.id,
    status: state.run.status,
    playbook_digest: state.playbook.digest,
    stages: state.stages.map((stage) => ({
      id: stage.id,
      status: stage.status,
      steps: stage.steps.map((step) => ({ id: step.id, status: step.status }))
    }))
  });
}

async function report(): Promise<void> {
  const store = new StateStore(root);
  const state = await store.load();
  await writeHardeningReport(root, state);
  print({ report: "HARDENING.md", run_id: state.run.id, status: state.run.status });
}

interface DokionManifest {
  capability_catalog?: {
    skills?: unknown[];
    tools?: unknown[];
    plugins_and_adapters?: unknown[];
  };
  loops?: {
    definitions?: unknown[];
  };
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
  const checks = {
    bun: Bun.version,
    git: Bun.which("git") ?? null,
    python3: Bun.which("python3") ?? null,
    active_playbook: await Bun.file(join(root, ".dokion/playbook.json")).exists(),
    state: await Bun.file(join(root, ".dokion/state.json")).exists()
  };
  print({ checks, healthy: Boolean(checks.git && checks.python3) });
}

async function findings(): Promise<void> {
  const glob = new Bun.Glob(".dokion/findings/**/*.json");
  const files: string[] = [];
  for await (const path of glob.scan({ cwd: root, onlyFiles: true })) files.push(path);
  const records = await Promise.all(files.sort().map((path) => readJson<unknown>(join(root, path))));
  print(records);
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
    case "status":
      await status();
      return;
    case "report":
      await report();
      return;
    case "findings":
      await findings();
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
