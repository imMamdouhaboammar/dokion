import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { verifyPlaybookPackage } from "../../src/registry/package/package-verifier.ts";

const roots: string[] = [];
const repositoryRoot = process.cwd();

async function makeSource(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-pack-cli-"));
  roots.push(root);
  await mkdir(join(root, "files"), { recursive: true });
  await writeFile(
    join(root, "dokion-package.json"),
    JSON.stringify({
      schema: "dokion.package-source.v1",
      namespace: "dokion-labs",
      name: "secure-web-app",
      version: "1.2.3",
      description: "A bounded web application hardening Playbook.",
      minimum_dokion_version: "0.3.0",
      platforms: ["linux-x64"],
      declared_capabilities: ["builtin.audit"]
    }, null, 2) + "\n"
  );
  await writeFile(
    join(root, "playbook.json"),
    JSON.stringify({
      schema_version: "1.0",
      metadata: { id: "secure-web-app", name: "Secure Web App", version: "1.2.3", owner: "dokion-labs" },
      authority: {
        installation: "USER",
        selection: "USER",
        substitution: "USER",
        ordering: "USER",
        permissions: "USER"
      },
      capabilities: [
        {
          id: "builtin.audit",
          type: "tool",
          source: "builtin",
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      ],
      stages: [{ id: "audit" }]
    }, null, 2) + "\n"
  );
  await writeFile(join(root, "README.md"), "# Secure Web App\n");
  await writeFile(join(root, "LICENSE"), "MIT\n");
  await writeFile(join(root, "files", "policy.txt"), "deny unsafe writes\n");
  return root;
}

async function runCli(...args: string[]) {
  const child = Bun.spawn([process.execPath, "run", "src/cli.ts", ...args], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { exitCode, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("dokion playbooks pack", () => {
  test("writes a verified inert package and reports exact evidence as JSON", async () => {
    const source = await makeSource();
    const outputRoot = await mkdtemp(join(tmpdir(), "dokion-pack-output-"));
    roots.push(outputRoot);
    const output = join(outputRoot, "secure-web-app-1.2.3.tar");

    const result = await runCli(
      "playbooks",
      "pack",
      "--from",
      source,
      "--output",
      output,
      "--format",
      "json"
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(report).toMatchObject({
      package_id: "dokion-labs/secure-web-app",
      version: "1.2.3",
      output,
      activated: false,
      published: false,
      payload_files: 4
    });
    expect(report.manifest_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.artifact_digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const artifact = new Uint8Array(await readFile(output));
    const verified = await verifyPlaybookPackage(repositoryRoot, artifact, {
      expectedArtifactDigest: String(report.artifact_digest),
      expectedManifestDigest: String(report.manifest_digest)
    });
    expect(verified.manifest.package.version).toBe("1.2.3");
    expect(verified.files.some((file) => file.path === "dokion-package.json")).toBe(false);
  });

  test("refuses to replace an existing output", async () => {
    const source = await makeSource();
    const outputRoot = await mkdtemp(join(tmpdir(), "dokion-pack-output-"));
    roots.push(outputRoot);
    const output = join(outputRoot, "package.tar");

    const first = await runCli("playbooks", "pack", "--from", source, "--output", output, "--format", "json");
    expect(first.exitCode, first.stderr).toBe(0);
    const original = new Uint8Array(await readFile(output));

    const second = await runCli("playbooks", "pack", "--from", source, "--output", output, "--format", "json");
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("Package output already exists");
    expect(new Uint8Array(await readFile(output))).toEqual(original);
  });

  test("refuses output inside the source directory", async () => {
    const source = await makeSource();
    const output = join(source, "package.tar");

    const result = await runCli("playbooks", "pack", "--from", source, "--output", output, "--format", "json");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot be written inside the source directory");
  });
});
