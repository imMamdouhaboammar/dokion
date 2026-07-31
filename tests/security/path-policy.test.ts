import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  evaluateRepositoryPath,
  type PathPolicyDenialReason
} from "../../src/security/path-policy.ts";

const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-path-policy-"));
  roots.push(root);
  return root;
}

async function expectDenied(
  root: string,
  requested: string,
  scopes: readonly string[],
  reason: PathPolicyDenialReason,
  options: Parameters<typeof evaluateRepositoryPath>[3] = {}
): Promise<void> {
  const decision = await evaluateRepositoryPath(root, requested, scopes, options);
  expect(decision.allowed).toBe(false);
  expect(decision.reason).toBe(reason);
  expect(decision.canonicalPath).toBeNull();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("EXEC-006 canonical repository path policy", () => {
  test("returns an allowed canonical repository-relative path", async () => {
    const root = await fixtureRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "entry.ts"), "export {};\n");

    const decision = await evaluateRepositoryPath(root, "src/entry.ts", ["src/"], {});

    expect(decision).toMatchObject({
      allowed: true,
      requested: "src/entry.ts",
      canonicalPath: "src/entry.ts",
      declaredScopes: ["src/"],
      reason: null
    });
    expect(decision.canonicalRoot).toBe(await realpath(root));
  });

  test("rejects POSIX, drive-letter, and UNC absolute paths", async () => {
    const root = await fixtureRoot();
    for (const requested of ["/tmp/outside", "C:outside.txt", "C:/outside.txt", "C:\\outside.txt", "\\\\host\\share\\x"]) {
      await expectDenied(root, requested, ["src/"], "ABSOLUTE_PATH");
    }
  });

  test("rejects parent traversal and alternate separators", async () => {
    const root = await fixtureRoot();
    await expectDenied(root, "src/../outside.txt", ["src/"], "PARENT_TRAVERSAL");
    await expectDenied(root, "src\\entry.ts", ["src/"], "ALTERNATE_SEPARATOR");
  });

  test("rejects a canonical path outside the declared scopes", async () => {
    const root = await fixtureRoot();
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "note.md"), "note\n");

    const decision = await evaluateRepositoryPath(root, "docs/note.md", ["src/"], {});

    expect(decision).toMatchObject({
      allowed: false,
      requested: "docs/note.md",
      canonicalPath: "docs/note.md",
      declaredScopes: ["src/"],
      reason: "OUTSIDE_DECLARED_SCOPE"
    });
  });

  test("canonicalizes an internal symlink before scope evaluation", async () => {
    const root = await fixtureRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "linked.ts"), "export {};\n");
    await symlink("src", join(root, "alias"));

    const decision = await evaluateRepositoryPath(root, "alias/linked.ts", ["src/"], {});

    expect(decision.allowed).toBe(true);
    expect(decision.canonicalPath).toBe("src/linked.ts");
  });

  test("rejects a symlink that escapes the repository root", async () => {
    const root = await fixtureRoot();
    const outside = await fixtureRoot();
    await writeFile(join(outside, "secret.txt"), "secret\n");
    await symlink(outside, join(root, "escape"));

    await expectDenied(root, "escape/secret.txt", ["escape/"], "SYMLINK_ESCAPE");
  });

  test("rejects case-fold collisions even on a case-sensitive host", async () => {
    const root = await fixtureRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "Token.ts"), "export {};\n");

    await expectDenied(root, "src/token.ts", ["src/"], "CASE_FOLD_COLLISION");
  });

  test("rejects a repository root that no longer matches the expected root", async () => {
    const parent = await fixtureRoot();
    const original = join(parent, "original");
    const replacement = join(parent, "replacement");
    const rootLink = join(parent, "repository");
    await mkdir(original);
    await mkdir(replacement);
    await symlink(original, rootLink);
    const expectedCanonicalRoot = await realpath(rootLink);
    await rm(rootLink);
    await symlink(replacement, rootLink);

    await expectDenied(rootLink, "file.txt", ["*.txt"], "ROOT_REPLACED", {
      expectedCanonicalRoot
    });
  });

  test("fails closed when filesystem guarantees are unproven", async () => {
    const root = await fixtureRoot();
    await expectDenied(root, "src/file.ts", ["src/"], "UNSUPPORTED_FILESYSTEM_GUARANTEE", {
      platform: "win32"
    });
  });

  test("rejects ambiguous empty and repeated path segments", async () => {
    const root = await fixtureRoot();
    await expectDenied(root, "", ["src/"], "INVALID_PATH");
    await expectDenied(root, "src//file.ts", ["src/"], "INVALID_PATH");
    await expectDenied(root, "src/./file.ts", ["src/"], "INVALID_PATH");
  });
});
