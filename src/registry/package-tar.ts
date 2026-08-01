import { DokionError } from "../core/errors.ts";
import { compareUtf8Bytes } from "./digests.ts";
import { assertUniquePackagePaths, archivePathForPackageFile, packagePathFromArchiveEntry } from "./package-paths.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";

const BLOCK_SIZE = 512;
const TERMINAL_BLOCKS_SIZE = BLOCK_SIZE * 2;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface RegistryTarEntry {
  path: string;
  bytes: Uint8Array;
}

function writeField(block: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", "Value does not fit in a deterministic USTAR field.", {
      value,
      maximumBytes: length
    });
  }
  block.set(bytes, offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "USTAR numeric fields require non-negative safe integers.", {
      value
    });
  }
  const octal = value.toString(8);
  if (octal.length > length - 1) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "USTAR numeric field overflow.", { value, fieldBytes: length });
  }
  writeField(block, offset, length, `${octal.padStart(length - 1, "0")}\0`);
}

function splitUstarPath(path: string): { name: string; prefix: string } {
  if (Buffer.byteLength(path, "utf8") <= 100) return { name: path, prefix: "" };

  for (let index = path.lastIndexOf("/"); index > 0; index = path.lastIndexOf("/", index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(name, "utf8") <= 100) {
      return { name, prefix };
    }
  }

  throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", "Package path cannot be represented by deterministic USTAR.", {
    path
  });
}

function createHeader(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE);
  const { name, prefix } = splitUstarPath(path);
  writeField(block, 0, 100, name);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  writeField(block, 156, 1, "0");
  writeField(block, 257, 6, "ustar\0");
  writeField(block, 263, 2, "00");
  writeField(block, 345, 155, prefix);

  const checksum = block.reduce((total, byte) => total + byte, 0);
  const checksumOctal = checksum.toString(8);
  if (checksumOctal.length > 6) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "USTAR checksum overflow.", { path, checksum });
  }
  writeField(block, 148, 8, `${checksumOctal.padStart(6, "0")}\0 `);
  return block;
}

export function createDeterministicPackageTar(entries: readonly RegistryTarEntry[]): Uint8Array {
  if (entries.length === 0 || entries.length > REGISTRY_PACKAGE_LIMITS.maximumFiles) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_MANY_FILES", "Package archive file count is outside the supported bound.", {
      count: entries.length,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumFiles
    });
  }

  const normalized = entries
    .map((entry) => ({ path: entry.path, bytes: Uint8Array.from(entry.bytes) }))
    .sort((left, right) => compareUtf8Bytes(left.path, right.path));
  assertUniquePackagePaths(normalized.map((entry) => entry.path));

  let totalPayloadBytes = 0;
  let archiveBytes = TERMINAL_BLOCKS_SIZE;
  for (const entry of normalized) {
    if (entry.bytes.length > REGISTRY_PACKAGE_LIMITS.maximumFileBytes) {
      throw new DokionError("REGISTRY_PACKAGE_FILE_TOO_LARGE", `Package file exceeds the individual size bound: ${entry.path}`, {
        path: entry.path,
        size: entry.bytes.length,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFileBytes
      });
    }
    totalPayloadBytes += entry.bytes.length;
    if (totalPayloadBytes > REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package payload exceeds the total unpacked size bound.", {
        size: totalPayloadBytes,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes
      });
    }
    archiveBytes += BLOCK_SIZE + Math.ceil(entry.bytes.length / BLOCK_SIZE) * BLOCK_SIZE;
  }
  if (archiveBytes > REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package archive exceeds the archive size bound.", {
      size: archiveBytes,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes
    });
  }

  const archive = new Uint8Array(archiveBytes);
  let offset = 0;
  for (const entry of normalized) {
    const archivePath = archivePathForPackageFile(entry.path);
    archive.set(createHeader(archivePath, entry.bytes.length), offset);
    offset += BLOCK_SIZE;
    archive.set(entry.bytes, offset);
    offset += Math.ceil(entry.bytes.length / BLOCK_SIZE) * BLOCK_SIZE;
  }
  return archive;
}

function allZero(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte === 0);
}

function readText(block: Uint8Array, offset: number, length: number): string {
  const field = block.slice(offset, offset + length);
  const nul = field.indexOf(0);
  const bounded = nul === -1 ? field : field.slice(0, nul);
  try {
    return textDecoder.decode(bounded);
  } catch {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive header contains invalid UTF-8.", { offset });
  }
}

function readOctal(block: Uint8Array, offset: number, length: number, field: string): number {
  const value = readText(block, offset, length).trim();
  if (!/^[0-7]+$/.test(value)) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", `Archive ${field} is not canonical octal.`, {
      field,
      value
    });
  }
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", `Archive ${field} is outside the safe integer range.`, {
      field,
      value
    });
  }
  return parsed;
}

function verifyHeaderChecksum(block: Uint8Array): void {
  const expected = readOctal(block, 148, 8, "checksum");
  const copy = Uint8Array.from(block);
  copy.fill(0x20, 148, 156);
  const observed = copy.reduce((total, byte) => total + byte, 0);
  if (expected !== observed) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive header checksum mismatch.", {
      expected,
      observed
    });
  }
}

function rejectCompressedArchive(bytes: Uint8Array): void {
  const signatures = [
    [0x1f, 0x8b],
    [0x50, 0x4b, 0x03, 0x04],
    [0x42, 0x5a, 0x68],
    [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00],
    [0x28, 0xb5, 0x2f, 0xfd]
  ];
  if (signatures.some((signature) => signature.every((byte, index) => bytes[index] === byte))) {
    throw new DokionError(
      "REGISTRY_PACKAGE_COMPRESSION_UNSUPPORTED",
      "dokion-package-tar-v1 is intentionally uncompressed; compressed archives are rejected before parsing."
    );
  }
}

export function readRegistryPackageTar(bytes: Uint8Array): RegistryTarEntry[] {
  rejectCompressedArchive(bytes);
  if (bytes.length > REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package archive exceeds the archive size bound.", {
      size: bytes.length,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes
    });
  }
  if (bytes.length < TERMINAL_BLOCKS_SIZE || bytes.length % BLOCK_SIZE !== 0) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Package archive must be a block-aligned USTAR stream.", {
      size: bytes.length
    });
  }

  const entries: RegistryTarEntry[] = [];
  const paths: string[] = [];
  let totalPayloadBytes = 0;
  let offset = 0;
  let terminated = false;

  while (offset + BLOCK_SIZE <= bytes.length) {
    const header = bytes.slice(offset, offset + BLOCK_SIZE);
    if (allZero(header)) {
      const secondTerminal = bytes.slice(offset + BLOCK_SIZE, offset + TERMINAL_BLOCKS_SIZE);
      if (secondTerminal.length !== BLOCK_SIZE || !allZero(secondTerminal)) {
        throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive termination requires two zero blocks.");
      }
      const trailing = bytes.slice(offset + TERMINAL_BLOCKS_SIZE);
      if (!allZero(trailing)) {
        throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive contains data after its terminal blocks.");
      }
      terminated = true;
      break;
    }

    verifyHeaderChecksum(header);
    const magic = readText(header, 257, 6);
    if (magic !== "ustar") {
      throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Only USTAR package archives are supported.", { magic });
    }
    const typeByte = header[156] ?? 0;
    if (typeByte !== 0 && typeByte !== 0x30) {
      throw new DokionError("REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED", "Package archives may contain regular files only.", {
        typeFlag: String.fromCharCode(typeByte)
      });
    }

    const name = readText(header, 0, 100);
    const prefix = readText(header, 345, 155);
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const path = packagePathFromArchiveEntry(archivePath);
    paths.push(path);
    assertUniquePackagePaths(paths);

    if (paths.length > REGISTRY_PACKAGE_LIMITS.maximumFiles) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_MANY_FILES", "Package archive exceeds the file-count bound.", {
        count: paths.length,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFiles
      });
    }

    const size = readOctal(header, 124, 12, "size");
    if (size > REGISTRY_PACKAGE_LIMITS.maximumFileBytes) {
      throw new DokionError("REGISTRY_PACKAGE_FILE_TOO_LARGE", `Package file exceeds the individual size bound: ${path}`, {
        path,
        size,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFileBytes
      });
    }
    totalPayloadBytes += size;
    if (totalPayloadBytes > REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package payload exceeds the total unpacked size bound.", {
        size: totalPayloadBytes,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes
      });
    }

    const payloadStart = offset + BLOCK_SIZE;
    const payloadEnd = payloadStart + size;
    const nextOffset = payloadStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    if (payloadEnd > bytes.length || nextOffset > bytes.length) {
      throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive entry extends beyond the available bytes.", {
        path,
        size
      });
    }
    if (!allZero(bytes.slice(payloadEnd, nextOffset))) {
      throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive entry padding must be zero-filled.", {
        path
      });
    }
    entries.push({ path, bytes: bytes.slice(payloadStart, payloadEnd) });
    offset = nextOffset;
  }

  if (!terminated) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive is missing terminal zero blocks.");
  }
  if (entries.length === 0) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Package archive contains no files.");
  }
  return entries;
}
