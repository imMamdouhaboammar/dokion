import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  ATOMIC_RECOVERY_LOG_PATH,
  ATOMIC_RECOVERY_QUARANTINE_PATH,
  createAtomicWriteMetadata,
  recoverAtomicWrites
} from "../../src/core/atomic-file.ts";
import { ExecutionEngine } from "../../src/engine/execution-engine.ts";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-atomic-recovery-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  return root;
}

async function stageAtomicWrite(
  root: string,
  targetPath: string,
  content: string,
  kind: "json" | "text",
  withMetadata = true
): Promise<void> {
  const target = join(root, targetPath);
  const temporary = `${target}.tmp`;
  await mkdir(dirname(temporary), { recursive: true });
  await writeFile(temporary, content);
  if (withMetadata) {
    await writeFile(
      `${temporary}.meta.json`,
      `${JSON.stringify(createAtomicWriteMetadata(basename(target), content, kind), null, 2)}\n`
    );
  }
}

async function readRecoveryRecords(root: string): Promise<Array<Record<string, unknown>>> {
  const raw = await readFile(join(root, ATOMIC_RECOVERY_LOG_PATH), "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line));
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("interrupted atomic-write recovery", () => {
  test("recovers a complete verified temporary file when the target is missing", async () => {
    const root = await createRoot();
    const content = `${JSON.stringify({ command: "bun test", exit_code: 0 }, null, 2)}\n`;
    await stageAtomicWrite(root, ".dokion/evidence/verification.json", content, "json");

    const records = await recoverAtomicWrites(root);

    expect(await readFile(join(root, ".dokion/evidence/verification.json"), "utf8")).toBe(content);
    await expect(access(join(root, ".dokion/evidence/verification.json.tmp"))).rejects.toBeDefined();
    await expect(access(join(root, ".dokion/evidence/verification.json.tmp.meta.json"))).rejects.toBeDefined();
    expect(records).toEqual([
      expect.objectContaining({
        action: "RECOVERED",
        target_path: ".dokion/evidence/verification.json",
        temporary_path: ".dokion/evidence/verification.json.tmp"
      })
    ]);
  });

  test("quarantines invalid or unverified JSON without creating the target", async () => {
    const root = await createRoot();
    await stageAtomicWrite(root, ".dokion/state.json", "{ partial", "json");
    await stageAtomicWrite(root, ".dokion/findings/no-meta.json", "{}\n", "json", false);

    const records = await recoverAtomicWrites(root);

    await expect(access(join(root, ".dokion/state.json"))).rejects.toBeDefined();
    await expect(access(join(root, ".dokion/findings/no-meta.json"))).rejects.toBeDefined();
    expect(records.map((record) => record.action)).toEqual(["QUARANTINED", "QUARANTINED"]);
    expect(records.map((record) => record.reason).sort()).toEqual(["INVALID_JSON", "MISSING_METADATA"]);
    const quarantined = await readdir(join(root, ATOMIC_RECOVERY_QUARANTINE_PATH), { recursive: true });
    expect(quarantined.some((path) => String(path).endsWith("state.json.tmp"))).toBe(true);
    expect(quarantined.some((path) => String(path).endsWith("no-meta.json.tmp"))).toBe(true);
  });

  test("preserves a valid final file and quarantines a conflicting temporary version", async () => {
    const root = await createRoot();
    const target = join(root, ".dokion/findings/DK-001.json");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify({ id: "final" })}\n`);
    await stageAtomicWrite(root, ".dokion/findings/DK-001.json", `${JSON.stringify({ id: "temporary" })}\n`, "json");

    const records = await recoverAtomicWrites(root);

    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({ id: "final" });
    expect(records).toEqual([
      expect.objectContaining({ action: "QUARANTINED", reason: "TARGET_CONFLICT" })
    ]);
  });

  test("discards an identical duplicate temporary file", async () => {
    const root = await createRoot();
    const content = "# Dokion report\n";
    await writeFile(join(root, "HARDENING.md"), content);
    await stageAtomicWrite(root, "HARDENING.md", content, "text");

    const records = await recoverAtomicWrites(root);

    expect(records).toEqual([
      expect.objectContaining({ action: "DISCARDED_DUPLICATE", target_path: "HARDENING.md" })
    ]);
    await expect(access(join(root, "HARDENING.md.tmp"))).rejects.toBeDefined();
  });

  test("ignores temporary files outside Dokion-owned paths", async () => {
    const root = await createRoot();
    await writeFile(join(root, "application-data.tmp"), "user-owned");

    expect(await recoverAtomicWrites(root)).toEqual([]);
    expect(await readFile(join(root, "application-data.tmp"), "utf8")).toBe("user-owned");
    await expect(access(join(root, ATOMIC_RECOVERY_LOG_PATH))).rejects.toBeDefined();
  });

  test("runs recovery before playbook loading at execution startup", async () => {
    const root = await createRoot();
    const content = `${JSON.stringify({ recovered: true })}\n`;
    await stageAtomicWrite(root, ".dokion/evidence/startup.json", content, "json");

    await expect(new ExecutionEngine(root).run()).rejects.toMatchObject({ code: "NO_ACTIVE_PLAYBOOK" });

    expect(await readFile(join(root, ".dokion/evidence/startup.json"), "utf8")).toBe(content);
    expect(await readRecoveryRecords(root)).toEqual([
      expect.objectContaining({ action: "RECOVERED", target_path: ".dokion/evidence/startup.json" })
    ]);
  });
});
