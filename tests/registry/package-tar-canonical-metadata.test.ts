import { describe, expect, test } from "bun:test";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import { createDeterministicPackageTar, readRegistryPackageTar } from "../../src/registry/package-tar.ts";

const BLOCK_SIZE = 512;

function writeAscii(bytes: Uint8Array, offset: number, length: number, value: string): void {
  bytes.fill(0, offset, offset + length);
  bytes.set(Buffer.from(value, "ascii"), offset);
}

function writeOctal(bytes: Uint8Array, offset: number, length: number, value: number): void {
  writeAscii(bytes, offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
}

function rewriteChecksum(bytes: Uint8Array, headerOffset = 0): void {
  bytes.fill(0x20, headerOffset + 148, headerOffset + 156);
  let checksum = 0;
  for (let index = headerOffset; index < headerOffset + BLOCK_SIZE; index += 1) checksum += bytes[index]!;
  writeAscii(bytes, headerOffset + 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
}

function validArchive(): Uint8Array {
  return createDeterministicPackageTar([
    { path: "LICENSE", bytes: Buffer.from("MIT\n") },
    { path: "README.md", bytes: Buffer.from("# Fixture\n") }
  ]);
}

function mutateHeader(mutator: (bytes: Uint8Array) => void): Uint8Array {
  const bytes = Uint8Array.from(validArchive());
  mutator(bytes);
  rewriteChecksum(bytes);
  return bytes;
}

function expectCode(action: () => unknown, code: DokionErrorCode, field?: string): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    if (field) expect((error as DokionError).details.field).toBe(field);
  }
}

describe("dokion-package-tar-v1 canonical USTAR metadata", () => {
  const noncanonicalNumericFields = [
    { name: "mode", offset: 100, length: 8, value: 0o600 },
    { name: "uid", offset: 108, length: 8, value: 1 },
    { name: "gid", offset: 116, length: 8, value: 1 },
    { name: "mtime", offset: 136, length: 12, value: 1 },
    { name: "device_major", offset: 329, length: 8, value: 1 },
    { name: "device_minor", offset: 337, length: 8, value: 1 }
  ] as const;

  for (const field of noncanonicalNumericFields) {
    test(`rejects noncanonical ${field.name}`, () => {
      const archive = mutateHeader((bytes) => writeOctal(bytes, field.offset, field.length, field.value));
      expectCode(() => readRegistryPackageTar(archive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", field.name);
    });
  }

  test("rejects a noncanonical regular-file type flag", () => {
    const archive = mutateHeader((bytes) => writeAscii(bytes, 156, 1, "\0"));
    expectCode(() => readRegistryPackageTar(archive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", "typeflag");
  });

  test("rejects an unsupported USTAR version", () => {
    const archive = mutateHeader((bytes) => writeAscii(bytes, 263, 2, "01"));
    expectCode(() => readRegistryPackageTar(archive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", "version");
  });

  test("rejects nonempty USTAR user and group names", () => {
    const userArchive = mutateHeader((bytes) => writeAscii(bytes, 265, 32, "root"));
    expectCode(() => readRegistryPackageTar(userArchive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", "uname");

    const groupArchive = mutateHeader((bytes) => writeAscii(bytes, 297, 32, "root"));
    expectCode(() => readRegistryPackageTar(groupArchive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", "gname");
  });

  test("rejects malformed numeric encodings even when the checksum is valid", () => {
    const archive = mutateHeader((bytes) => writeAscii(bytes, 100, 8, "0000644 "));
    expectCode(() => readRegistryPackageTar(archive), "REGISTRY_PACKAGE_ARCHIVE_INVALID", "mode");
  });
});
