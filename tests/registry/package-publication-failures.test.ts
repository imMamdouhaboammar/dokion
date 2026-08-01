import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_REGISTRY_ARTIFACT_PUBLICATION_IO,
  publishRegistryPackageArtifact,
  type RegistryArtifactPublicationIO,
  type RegistryArtifactWritableHandle
} from "../../src/registry/package-publisher.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-package-publication-"));
  roots.push(root);
  return root;
}

function injectedFailureIO(stage: "write" | "sync"): RegistryArtifactPublicationIO {
  return {
    ...DEFAULT_REGISTRY_ARTIFACT_PUBLICATION_IO,
    async openTemporary(path, flags, mode): Promise<RegistryArtifactWritableHandle> {
      const handle = await DEFAULT_REGISTRY_ARTIFACT_PUBLICATION_IO.openTemporary(path, flags, mode);
      return {
        async writeFile(bytes): Promise<void> {
          if (stage === "write") {
            await handle.writeFile(bytes.slice(0, 1));
            const error = new Error("simulated artifact write failure") as NodeJS.ErrnoException;
            error.code = "EIO";
            throw error;
          }
          await handle.writeFile(bytes);
        },
        async sync(): Promise<void> {
          if (stage === "sync") {
            const error = new Error("simulated artifact sync failure") as NodeJS.ErrnoException;
            error.code = "EIO";
            throw error;
          }
          await handle.sync();
        },
        async close(): Promise<void> {
          await handle.close();
        }
      };
    }
  };
}

async function expectPublicationFailure(action: Promise<void>, message: string): Promise<void> {
  try {
    await action;
    throw new Error("Expected publication failure");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(message);
  }
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package artifact publication cleanup", () => {
  for (const stage of ["write", "sync"] as const) {
    test(`removes temporary artifacts after an injected ${stage} failure`, async () => {
      const root = await temporaryRoot();
      const outputPath = join(root, "dist", "package.dokion-package");
      const expectedMessage = stage === "write"
        ? "simulated artifact write failure"
        : "simulated artifact sync failure";

      await expectPublicationFailure(
        publishRegistryPackageArtifact(
          Buffer.from("deterministic artifact bytes"),
          outputPath,
          false,
          injectedFailureIO(stage)
        ),
        expectedMessage
      );

      const names = await readdir(join(root, "dist"));
      expect(names.filter((name) => name.includes(".dokion-tmp-"))).toEqual([]);
      expect(names).not.toContain("package.dokion-package");
    });
  }
});
