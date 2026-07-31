import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { sha256 } from "../../src/core/digest.ts";
import { spoolOutput } from "../../src/execution/output-spool.ts";

const roots: string[] = [];
const encoder = new TextEncoder();

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "dokion-output-spool-"));
  roots.push(value);
  return value;
}

function stream(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true })));
});

describe("EXEC-004 bounded output evidence spool", () => {
  test("writes complete text output atomically with bounded summary and digests", async () => {
    const project = await root();
    const content = encoder.encode("hello from dokion\nsecond line\n");
    const result = await spoolOutput(stream(content.subarray(0, 7), content.subarray(7)), {
      root: project,
      artifactPath: ".dokion/evidence/run-1/stdout.bin",
      maxArtifactBytes: 1024,
      maxSummaryBytes: 16
    });

    expect(result).toEqual({
      artifactPath: ".dokion/evidence/run-1/stdout.bin",
      mediaType: "text/plain; charset=utf-8",
      bytesObserved: content.byteLength,
      bytesStored: content.byteLength,
      truncated: false,
      artifactDigest: sha256(content),
      observedDigest: sha256(content),
      summary: "hello from dokio",
      summaryEncoding: "utf8"
    });
    expect(new Uint8Array(await readFile(join(project, result.artifactPath)))).toEqual(content);
  });

  test("continues observing after the artifact bound and records truncation", async () => {
    const project = await root();
    const chunks = Array.from({ length: 20 }, (_, index) => encoder.encode(`${index}`.padStart(4, "0")));
    const observed = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      observed.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const result = await spoolOutput(stream(...chunks), {
      root: project,
      artifactPath: ".dokion/evidence/run-1/stderr.bin",
      maxArtifactBytes: 25,
      maxSummaryBytes: 12
    });

    expect(result.bytesObserved).toBe(80);
    expect(result.bytesStored).toBe(25);
    expect(result.truncated).toBe(true);
    expect(result.truncationMarker).toBe("DOKION_OUTPUT_TRUNCATED");
    expect(result.summary).toBe("000000010002");
    expect(result.artifactDigest).toBe(sha256(observed.subarray(0, 25)));
    expect(result.observedDigest).toBe(sha256(observed));
    expect(new Uint8Array(await readFile(join(project, result.artifactPath)))).toEqual(observed.subarray(0, 25));
  });

  test("represents binary summaries as base64 without corrupting the artifact", async () => {
    const project = await root();
    const binary = new Uint8Array([0, 255, 1, 2, 3, 4]);
    const result = await spoolOutput(stream(binary), {
      root: project,
      artifactPath: ".dokion/evidence/run-1/output.bin",
      maxArtifactBytes: 64,
      maxSummaryBytes: 4
    });

    expect(result.mediaType).toBe("application/octet-stream");
    expect(result.summaryEncoding).toBe("base64");
    expect(result.summary).toBe(Buffer.from(binary.subarray(0, 4)).toString("base64"));
    expect(new Uint8Array(await readFile(join(project, result.artifactPath)))).toEqual(binary);
  });

  test("removes partial temporary output when the stream fails", async () => {
    const project = await root();
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("partial"));
        controller.error(new Error("stream failed"));
      }
    });

    await expect(spoolOutput(failing, {
      root: project,
      artifactPath: ".dokion/evidence/run-1/failing.bin",
      maxArtifactBytes: 64,
      maxSummaryBytes: 16
    })).rejects.toThrow("stream failed");

    expect(await Bun.file(join(project, ".dokion/evidence/run-1/failing.bin")).exists()).toBe(false);
    const directory = join(project, ".dokion/evidence/run-1");
    const entries = await readdir(directory).catch(() => [] as string[]);
    expect(entries.filter((entry) => entry.includes("failing.bin") && entry.endsWith(".tmp"))).toEqual([]);
  });

  test("preserves existing evidence and rejects unsafe paths or unbounded options", async () => {
    const project = await root();
    const existingPath = join(project, ".dokion/evidence/run-1/existing.bin");
    await mkdir(join(project, ".dokion/evidence/run-1"), { recursive: true });
    await writeFile(existingPath, "original");

    await expect(spoolOutput(stream(encoder.encode("replacement")), {
      root: project,
      artifactPath: ".dokion/evidence/run-1/existing.bin",
      maxArtifactBytes: 64,
      maxSummaryBytes: 16
    })).rejects.toBeInstanceOf(DokionError);
    expect(await readFile(existingPath, "utf8")).toBe("original");

    const invalidOptions = [
      { artifactPath: "../outside.bin", maxArtifactBytes: 64, maxSummaryBytes: 16 },
      { artifactPath: "/absolute.bin", maxArtifactBytes: 64, maxSummaryBytes: 16 },
      { artifactPath: ".dokion/evidence/out.bin", maxArtifactBytes: -1, maxSummaryBytes: 16 },
      { artifactPath: ".dokion/evidence/out.bin", maxArtifactBytes: 64, maxSummaryBytes: -1 },
      { artifactPath: ".dokion/evidence/out.bin", maxArtifactBytes: 64 * 1024 * 1024 + 1, maxSummaryBytes: 16 },
      { artifactPath: ".dokion/evidence/out.bin", maxArtifactBytes: 64, maxSummaryBytes: 64 * 1024 + 1 }
    ];

    for (const options of invalidOptions) {
      await expect(spoolOutput(stream(encoder.encode("data")), {
        root: project,
        ...options
      })).rejects.toBeInstanceOf(DokionError);
    }
  });
});
