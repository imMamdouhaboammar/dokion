import { describe, expect, test } from "bun:test";

const root = process.cwd();

describe("official GitHub Action contract", () => {
  test("invokes only supported CLI syntax through the installed binary", async () => {
    const source = await Bun.file(`${root}/action.yml`).text();

    expect(source).not.toContain("bunx dokion");
    expect(source).not.toContain("--playbook");
    expect(source).toContain("dokion validate");
    expect(source).toContain("dokion run");
  });

  test("pins the runtime and requires the canonical active authority file", async () => {
    const source = await Bun.file(`${root}/action.yml`).text();

    expect(source).toContain("default: '0.3.0'");
    expect(source).toContain("bun-version: 1.3.14");
    expect(source).toContain(".dokion/playbook.json");
    expect(source).not.toContain("default: 'latest'");
  });
});
