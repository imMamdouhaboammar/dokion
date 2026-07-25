import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("production readiness documentation contract", () => {
  test("separates Dokion release readiness from target repository readiness", async () => {
    const definition = await read("docs/architecture/production-readiness.md");

    expect(definition).toContain("Dokion runtime production readiness");
    expect(definition).toContain("Target repository scoped readiness");
    expect(definition).toContain("No unqualified production-ready claim");
    expect(definition).toContain("does not transfer");
  });

  test("defines the required production-grade proof lanes", async () => {
    const definition = await read("docs/architecture/production-readiness.md");

    for (const lane of [
      "authority and policy safety",
      "state and recovery integrity",
      "command and repair containment",
      "evidence and auditability",
      "cross-platform and cross-agent behavior",
      "distribution and supply-chain integrity",
      "seeded-fixture acceptance",
      "operational documentation"
    ]) {
      expect(definition).toContain(lane);
    }
  });

  test("links the normative readiness definition from the specification", async () => {
    const specification = await read("SPEC.md");

    expect(specification).toContain("### 11.4 Dokion runtime production readiness");
    expect(specification).toContain("docs/architecture/production-readiness.md");
    expect(specification).toContain("A target repository readiness result remains scoped");
  });
});
