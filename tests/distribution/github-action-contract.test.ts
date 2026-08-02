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

  test("publishes a report path only when the report exists", async () => {
    const source = await Bun.file(`${root}/action.yml`).text();

    expect(source).toContain('if [ -f "HARDENING.md" ]; then');
    expect(source).toContain('echo "report-path=$PWD/HARDENING.md" >> "$GITHUB_OUTPUT"');
    expect(source).toContain('echo "report-path=" >> "$GITHUB_OUTPUT"');
    expect(source).not.toContain('echo "report-path=HARDENING.md" >> "$GITHUB_OUTPUT"');
  });

  test("makes the Action workflow assert the recorded run outcome", async () => {
    const source = await Bun.file(`${root}/.github/workflows/test-action.yml`).text();

    expect(source).toContain("id: dokion");
    expect(source).toContain("steps.dokion.outputs.status");
    expect(source).toContain("steps.dokion.outputs['exit-code']");
    expect(source).toContain('test "$DOKION_STATUS" = "FAILED"');
    expect(source).toContain('test "$DOKION_EXIT_CODE" -ne 0');
  });
});
