import { expect, test } from "bun:test";

const root = process.cwd();

function emit(name: string, content: string): void {
  const encoded = Buffer.from(content, "utf8").toString("base64");
  console.log(`DOKION_${name}_BEGIN`);
  for (let index = 0; index < encoded.length; index += 4000) {
    console.log(encoded.slice(index, index + 4000));
  }
  console.log(`DOKION_${name}_END`);
}

test("generates reconciled documentation artifacts", async () => {
  const specification = await Bun.file(`${root}/SPEC.md`).text();
  const readme = await Bun.file(`${root}/README.md`).text();

  const staleStatus = "**Status:** spec-stage. This repository defines the system; it does not yet implement it.\n**Version:** 1.0.0\n**Tagline:** Your rules. Your tools. Proven software.";
  const currentStatus = "**Status:** Runtime baseline M0-M6 implemented.\n**Specification version:** 1.0.0\n**Tagline:** Your rules. Your tools. Proven software.\n\nProduction hardening backlog: in progress.\n\nThe implemented baseline is recorded in [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md). This status does not assert general production readiness for Dokion or for any repository evaluated by Dokion.";

  const oldMilestones = `### 14.1 Milestones

Each has a binary acceptance test. Do not proceed until it passes.

| M | Scope | Acceptance |
|---|---|---|
| **M0** | Schemas + validation CI | All schemas and playbooks validate; CI fails on a malformed playbook; CI fails on \`sha256:PLACEHOLDER\` in an active playbook |
| **M1** | Loader, digest pinning, enforcement hook | Mid-run playbook mutation aborts as \`TAINTED\` with expected vs observed recorded; hook blocks a direct write on Claude Code; hookless agents record \`NO_HOOK_ENFORCEMENT\` |
| **M2** | Execution engine + journal writer | A three-step playbook runs in declared order; killing and resuming reproduces exact state from disk with nothing lost |
| **M3** | Vertical slice: the security stage of \`example.playbook.json\` | Findings produced → normalized → approval-gated → repaired → verified → journaled, with BEFORE and AFTER artifacts |
| **M4** | Validation policy + adversary | A faked fix (suppression over a real defect) is caught; the finding lands in \`REJECTED_BY_VALIDATION\`, never \`VERIFIED\` |
| **M5** | Reference playbooks + adapters | Identical canonical \`SKILL.md\` files load in all three agents; each run reports its own degradations |
| **M6** | Marketplace publish | \`claude plugin validate --strict\` passes; clean install reproduces M3 in a fresh checkout |`;

  const newMilestones = `### 14.1 Implemented milestone baseline

Runtime baseline: M0-M6 implemented. Each milestone is limited to behavior covered by code and CI at the audited baseline in [\`docs/architecture/current-baseline.md\`](docs/architecture/current-baseline.md).

| M | Scope | Status | Audited acceptance evidence |
|---|---|---|---|
| **M0** | Schemas and validation CI | Implemented | Schemas, reference playbooks, and catalog contracts validate; malformed active playbooks and unresolved digest placeholders are rejected |
| **M1** | Loader, digest pinning, and enforcement guard | Implemented | Active playbook mutation is detected as \`TAINTED\`; Claude Code receives a fail-closed guard; weaker platforms record degradations |
| **M2** | Execution engine and journal | Implemented | Declared stages and steps execute in order with disk state, events, evidence, reporting, and resume |
| **M3** | Findings and remediation lifecycle | Implemented | Findings are normalized, approval-gated, repaired through declared commands, verified, and persisted with evidence |
| **M4** | Adversarial repair validation and readiness gates | Implemented | Out-of-scope edits, suppression, deleted tests, missing regression evidence, and failed verification reject and roll back repairs |
| **M5** | Cross-agent adapters | Implemented | One canonical hardening skill is packaged for Claude Code, Codex, and Gemini CLI with explicit platform degradations |
| **M6** | Distribution and release | Implemented | Embedded assets, exact package inspection, clean Bun installation, Gemini extension validation, five compiled binaries, and protected tag release automation pass CI |

Production hardening backlog: in progress. The next backlog adds missing CLI commands, stronger state integrity, capability provenance, bounded autopilot, module contracts, broader platform proof, and release attestations. This status does not assert general production readiness.`;

  const readmeOld = `## Current status

Dokion is an executable Bun CLI with cross-agent packaging, adversarial repair validation, clean-install reproduction, package validation, and a protected Bun-only release pipeline.`;
  const readmeNew = `## Current status

Runtime baseline: M0-M6 implemented.

Production hardening backlog: in progress.

Dokion is an executable Bun CLI with cross-agent packaging, adversarial repair validation, clean-install reproduction, package validation, and a protected Bun-only release pipeline. The audited baseline is recorded in [\`docs/architecture/current-baseline.md\`](docs/architecture/current-baseline.md), and the active production backlog is recorded in [the 100-commit implementation plan](docs/superpowers/plans/2026-07-25-production-grade-bounded-autopilot-backlog.md). This status does not assert general production readiness.`;

  const nextSpecification = specification.replace(staleStatus, currentStatus).replace(oldMilestones, newMilestones);
  const nextReadme = readme.replace(readmeOld, readmeNew);

  expect(nextSpecification).not.toBe(specification);
  expect(nextReadme).not.toBe(readme);
  expect(nextSpecification).not.toContain("**Status:** spec-stage");
  expect(nextSpecification).toContain("| **M6** | Distribution and release | Implemented |");
  expect(nextReadme).toContain("Production hardening backlog: in progress");

  emit("SPEC", nextSpecification);
  emit("README", nextReadme);
});
