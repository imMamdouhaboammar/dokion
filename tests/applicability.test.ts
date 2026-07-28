import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initializeGitFixture } from "./helpers/git-fixture.ts";

import { evaluateApplicability } from "../src/applicability/evaluate-applicability.ts";
import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import type { ProjectProfile } from "../src/inspect/project-inspector.ts";

const roots: string[] = [];

function profile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    languages: ["TypeScript"],
    frameworks: [],
    package_managers: ["bun"],
    has_frontend: false,
    has_api: true,
    has_database: false,
    has_llm: false,
    has_infrastructure: false,
    is_monorepo: false,
    detected_at: new Date().toISOString(),
    ...overrides
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-applicability-"));
  roots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/index.ts"), "export const ready = true;\n");
  return root;
}

async function runtimeFixture(): Promise<string> {
  const root = await temporaryRoot();
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "applicability-fixture", scripts: {} }, null, 2));
  await initializeGitFixture(root);

  const raw = await readFile(join(process.cwd(), "playbooks/example.playbook.json"), "utf8");
  const playbook = JSON.parse(raw.replaceAll("sha256:PLACEHOLDER", `sha256:${"a".repeat(64)}`));
  const template = playbook.stages[0].steps[0];
  const skippedCommand = "printf 'skipped\\n' >> .dokion/order.log";
  const executedCommand = "printf 'executed\\n' >> .dokion/order.log";

  playbook.project.name = "applicability-fixture";
  playbook.project.target = "READY_FOR_STAGING";
  playbook.stages = [
    {
      id: "runtime",
      name: "Runtime",
      execution: "SEQUENTIAL",
      steps: [
        {
          ...structuredClone(template),
          id: "frontend-only",
          responsibility: "Run only for declared frontend projects.",
          mode: "VERIFY_ONLY",
          approval: "NEVER",
          applicability: {
            when_profile: { has_frontend: true },
            on_inapplicable: "SKIP"
          },
          capability: {
            ...structuredClone(template.capability),
            id: "frontend-only-command",
            immutable_reference: `sha256:${"b".repeat(64)}`
          },
          permissions: {
            read: ["**/*"],
            write: [".dokion/**", "HARDENING.md"],
            network: false,
            shell: [skippedCommand]
          },
          verification: [skippedCommand],
          success_conditions: ["verification_exit_zero"],
          failure_policy: "STOP_PIPELINE"
        },
        {
          ...structuredClone(template),
          id: "always-run",
          responsibility: "Run when no applicability constraint is declared.",
          mode: "VERIFY_ONLY",
          approval: "NEVER",
          capability: {
            ...structuredClone(template.capability),
            id: "always-run-command",
            immutable_reference: `sha256:${"c".repeat(64)}`
          },
          permissions: {
            read: ["**/*"],
            write: [".dokion/**", "HARDENING.md"],
            network: false,
            shell: [executedCommand]
          },
          verification: [executedCommand],
          success_conditions: ["verification_exit_zero"],
          failure_policy: "STOP_PIPELINE"
        }
      ]
    }
  ];
  playbook.release_gates = [];
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("declared applicability", () => {
  test("accepts a declaration when every configured condition matches", async () => {
    const root = await temporaryRoot();
    await writeFile(join(root, "package.json"), "{}\n");

    const result = await evaluateApplicability({
      root,
      platform: "codex",
      profile: profile({ languages: ["TypeScript", "JavaScript"], has_api: true }),
      applicability: {
        when_paths_exist: ["src/**/*.ts", "package.json"],
        when_paths_absent: ["Cargo.toml"],
        when_platform: ["codex", "claude_code"],
        when_profile: { has_api: true, languages: ["TypeScript"] },
        on_inapplicable: "SKIP"
      }
    });

    expect(result).toEqual({ applicable: true, reason: "all declared applicability conditions matched" });
  });

  test("rejects path, profile, and platform mismatches with deterministic reasons", async () => {
    const root = await temporaryRoot();

    expect(await evaluateApplicability({
      root,
      platform: "codex",
      profile: profile(),
      applicability: { when_paths_exist: ["missing/**/*.ts"] }
    })).toEqual({ applicable: false, reason: "required path pattern has no match: missing/**/*.ts" });

    expect(await evaluateApplicability({
      root,
      platform: "codex",
      profile: profile(),
      applicability: { when_paths_absent: ["src/**/*.ts"] }
    })).toEqual({ applicable: false, reason: "forbidden path pattern matched: src/**/*.ts" });

    expect(await evaluateApplicability({
      root,
      platform: "codex",
      profile: profile(),
      applicability: { when_profile: { has_frontend: true } }
    })).toEqual({ applicable: false, reason: "profile mismatch: has_frontend" });

    expect(await evaluateApplicability({
      root,
      platform: "codex",
      profile: profile(),
      applicability: { when_platform: ["claude_code"] }
    })).toEqual({ applicable: false, reason: "platform codex is not declared applicable" });
  });

  test("the runtime skips an inapplicable declared step and continues in order", async () => {
    const root = await runtimeFixture();
    const state = await new ExecutionEngine(root).run();

    expect(state.run.status).toBe("COMPLETED");
    expect(state.profile?.has_frontend).toBe(false);
    expect(state.stages[0]?.steps[0]?.status).toBe("SKIPPED_INAPPLICABLE");
    expect(state.stages[0]?.steps[0]?.skip_reason).toBe("profile mismatch: has_frontend");
    expect(state.stages[0]?.steps[1]?.status).toBe("SUCCEEDED");
    expect(await readFile(join(root, ".dokion/order.log"), "utf8")).toBe("executed\n");
  }, 20000);
});
