import { describe, expect, test } from "bun:test";
import { classifyGoal, derivePredicate, screenCommand, detectPlateau, createInitialState } from "../../src/autoresearch/orchestrator.ts";

describe("Autoresearch Orchestrator", () => {
  test("classifies goal archetypes correctly", () => {
    expect(classifyGoal("Fix broken tests and crush errors").archetype).toBe("fix-broken");
    expect(classifyGoal("Optimize test coverage and reduce bundle size").archetype).toBe("optimize-metric");
    expect(classifyGoal("Ship production release to main").archetype).toBe("ship-ready");
    expect(classifyGoal("Harden security against OWASP vulnerabilities").archetype).toBe("harden");
    expect(classifyGoal("Build new feature for user management").archetype).toBe("build-feature");
    expect(classifyGoal("Document the codebase").archetype).toBe("document");
  });

  test("derives appropriate success predicates", () => {
    const fixPred = derivePredicate("Fix bug", "fix-broken");
    expect(fixPred.command).toBe("bun test");
    expect(fixPred.expectedExitCode).toBe(0);

    const hardenPred = derivePredicate("Harden app", "harden");
    expect(hardenPred.command).toBe("bun run validate:contracts");
  });

  test("screens commands for security invariants", () => {
    expect(screenCommand("bun test").allowed).toBe(true);
    expect(screenCommand("rm -rf /").allowed).toBe(false);
    expect(screenCommand("sudo chmod 777 /etc").allowed).toBe(false);
  });

  test("detects plateau in metric history", () => {
    expect(detectPlateau([100, 90, 80, 80, 80, 80, 80])).toBe(true);
    expect(detectPlateau([100, 90, 80, 70, 60])).toBe(false);
  });

  test("creates initial state cleanly", () => {
    const state = createInitialState("Fix failing tests");
    expect(state.goal).toBe("Fix failing tests");
    expect(state.archetype).toBe("fix-broken");
    expect(state.status).toBe("RUNNING");
    expect(state.unitsRemaining).toBe(100);
  });
});
