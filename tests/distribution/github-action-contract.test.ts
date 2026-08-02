import { describe, expect, test } from "bun:test";

const root = process.cwd();

function compositeRunSource(source: string): string {
  const blocks: string[] = [];
  const lines = source.split(/\r?\n/);
  let runIndent: number | null = null;

  for (const line of lines) {
    const start = line.match(/^(\s*)run:\s*\|\s*$/);
    if (start) {
      runIndent = start[1]!.length;
      continue;
    }

    if (runIndent === null) continue;
    const indentation = line.length - line.trimStart().length;
    if (line.trim().length > 0 && indentation <= runIndent) {
      runIndent = null;
      continue;
    }
    blocks.push(line);
  }

  return blocks.join("\n");
}

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

  test("passes caller inputs through environment variables and validates allowlists", async () => {
    const source = await Bun.file(`${root}/action.yml`).text();
    const shellSource = compositeRunSource(source);

    expect(source).toContain("DOKION_VERSION_INPUT: ${{ inputs.dokion-version }}");
    expect(source).toContain("PLAYBOOK_INPUT: ${{ inputs.playbook }}");
    expect(source).toContain("FAIL_ON_FINDINGS_INPUT: ${{ inputs.fail-on-findings }}");
    expect(source).toContain("CREATE_SUMMARY_INPUT: ${{ inputs.create-summary }}");
    expect(source).toContain('bun add --global "dokion@$DOKION_VERSION_INPUT"');
    expect(source).toContain('if ! [[ "$DOKION_VERSION_INPUT" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+');
    expect(source).toContain('case "$FAIL_ON_FINDINGS_INPUT" in');
    expect(source).toContain('case "$CREATE_SUMMARY_INPUT" in');
    expect(shellSource).not.toContain("${{ inputs.");
    expect(shellSource).not.toContain("${{ steps.");
    expect(source).not.toContain("dokion@${{ inputs.dokion-version }}");
  });

  test("publishes a report path only when the report exists", async () => {
    const source = await Bun.file(`${root}/action.yml`).text();

    expect(source).toContain('if [ -f "HARDENING.md" ]; then');
    expect(source).toContain('echo "report-path=$PWD/HARDENING.md" >> "$GITHUB_OUTPUT"');
    expect(source).toContain('echo "report-path=" >> "$GITHUB_OUTPUT"');
    expect(source).not.toContain('echo "report-path=HARDENING.md" >> "$GITHUB_OUTPUT"');
  });

  test("makes the Action workflow assert the recorded run and injection outcomes", async () => {
    const source = await Bun.file(`${root}/.github/workflows/test-action.yml`).text();

    expect(source).toContain("id: dokion");
    expect(source).toContain("steps.dokion.outputs.status");
    expect(source).toContain("steps.dokion.outputs['exit-code']");
    expect(source).toContain('test "$DOKION_STATUS" = "FAILED"');
    expect(source).toContain('test "$DOKION_EXIT_CODE" -ne 0');
    expect(source).toContain("id: malicious-version");
    expect(source).toContain("0.3.0; touch /tmp/dokion-action-injected");
    expect(source).toContain('test "$MALICIOUS_OUTCOME" = "failure"');
    expect(source).toContain("test ! -e /tmp/dokion-action-injected");
  });
});
