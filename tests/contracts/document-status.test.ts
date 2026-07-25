import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  return Bun.file(`${root}/${path}`).text();
}

describe("documentation implementation status contract", () => {
  test("does not describe the implemented runtime as spec-only", async () => {
    const specification = await read("SPEC.md");

    expect(specification).not.toContain("**Status:** spec-stage");
    expect(specification).not.toContain("This repository defines the system; it does not yet implement it.");
  });

  test("README and specification publish the same implementation marker", async () => {
    const [readme, specification] = await Promise.all([read("README.md"), read("SPEC.md")]);
    const marker = "M0-M6 implemented";

    expect(readme).toContain(marker);
    expect(specification).toContain(marker);
    expect(readme).toContain("docs/architecture/current-baseline.md");
    expect(specification).toContain("docs/architecture/current-baseline.md");
  });

  test("keeps implemented milestones separate from the production backlog", async () => {
    const [readme, specification] = await Promise.all([read("README.md"), read("SPEC.md")]);

    expect(readme).toContain("Production hardening backlog: in progress");
    expect(specification).toContain("Production hardening backlog: in progress");
    expect(specification).toContain("| **M6** | Distribution and release | Implemented |");
    expect(specification).toContain("This status does not assert general production readiness");
  });
});
