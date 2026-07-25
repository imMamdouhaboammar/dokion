import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("bounded autopilot documentation contract", () => {
  test("defines autopilot as deterministic continuation rather than authority", async () => {
    const contract = await read("docs/architecture/bounded-autopilot.md");

    expect(contract).toContain("Autopilot is execution continuity, not decision authority");
    expect(contract).toContain(".dokion/playbook.json");
    expect(contract).toContain("deterministic next action");
    expect(contract).toContain("inert recommendations");
  });

  test("records mandatory stops and forbidden actions", async () => {
    const contract = await read("docs/architecture/bounded-autopilot.md");

    for (const stop of [
      "required approval",
      "playbook digest mismatch",
      "capability lock mismatch",
      "repository identity change",
      "run budget exhausted",
      "missing evidence",
      "unsupported platform guarantee"
    ]) {
      expect(contract).toContain(stop);
    }

    for (const forbidden of [
      "select a capability",
      "install a capability",
      "reorder declared steps",
      "expand write scope",
      "change release gates",
      "activate a proposed playbook",
      "deploy to production"
    ]) {
      expect(contract).toContain(forbidden);
    }
  });

  test("links the normative contract from the specification", async () => {
    const specification = await read("SPEC.md");

    expect(specification).toContain("### 2.5 Bounded autopilot");
    expect(specification).toContain("docs/architecture/bounded-autopilot.md");
    expect(specification).toContain("Autopilot never enlarges authority");
  });
});
