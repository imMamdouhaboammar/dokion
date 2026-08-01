import { randomUUID } from "node:crypto";
import { link, mkdir, open, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { DokionError } from "../core/errors.ts";

export interface RegistryArtifactWritableHandle {
  writeFile(bytes: Uint8Array): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface RegistryArtifactPublicationIO {
  mkdir(path: string): Promise<void>;
  openTemporary(path: string, flags: "wx", mode: number): Promise<RegistryArtifactWritableHandle>;
  link(existingPath: string, newPath: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  unlink(path: string): Promise<void>;
  syncDirectory(path: string): Promise<void>;
}

const UNSUPPORTED_DIRECTORY_SYNC_CODES = new Set(["EBADF", "EINVAL", "EISDIR", "ENOTSUP"]);

async function syncDirectory(path: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode && UNSUPPORTED_DIRECTORY_SYNC_CODES.has(errorCode)) return;
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export const DEFAULT_REGISTRY_ARTIFACT_PUBLICATION_IO: RegistryArtifactPublicationIO = Object.freeze({
  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  },
  async openTemporary(path: string, flags: "wx", mode: number): Promise<RegistryArtifactWritableHandle> {
    const handle = await open(path, flags, mode);
    return {
      async writeFile(bytes: Uint8Array): Promise<void> {
        await handle.writeFile(bytes);
      },
      async sync(): Promise<void> {
        await handle.sync();
      },
      async close(): Promise<void> {
        await handle.close();
      }
    };
  },
  async link(existingPath: string, newPath: string): Promise<void> {
    await link(existingPath, newPath);
  },
  async rename(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
  },
  async unlink(path: string): Promise<void> {
    await unlink(path);
  },
  syncDirectory
});

export async function publishRegistryPackageArtifact(
  bytes: Uint8Array,
  outputPath: string,
  overwrite: boolean,
  io: RegistryArtifactPublicationIO = DEFAULT_REGISTRY_ARTIFACT_PUBLICATION_IO
): Promise<void> {
  const outputDirectory = dirname(outputPath);
  const temporaryPath = join(
    outputDirectory,
    `.${basename(outputPath)}.dokion-tmp-${process.pid}-${randomUUID()}`
  );

  let handle: RegistryArtifactWritableHandle | undefined;
  try {
    await io.mkdir(outputDirectory);
    handle = await io.openTemporary(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;

    if (overwrite) {
      await io.rename(temporaryPath, outputPath);
    } else {
      try {
        await io.link(temporaryPath, outputPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new DokionError("REGISTRY_PACKAGE_OUTPUT_EXISTS", `Package output already exists: ${outputPath}`, {
            outputPath
          });
        }
        throw error;
      }
      await io.unlink(temporaryPath);
    }

    await io.syncDirectory(outputDirectory);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    handle = undefined;
    await io.unlink(temporaryPath).catch(() => undefined);
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
    await io.unlink(temporaryPath).catch(() => undefined);
  }
}
