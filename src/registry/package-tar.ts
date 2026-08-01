import { DokionError } from "../core/errors.ts";
import { compareUtf8Bytes } from "./digests.ts";
import {
  assertUniquePackagePaths,
  archivePathForPackageFile,
  PackagePathRegistry,
  packagePathFromArchiveEntry,
  splitUstarPath
} from "./package-paths.ts";
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

function invalidHeaderField(field: string, message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", message, { field, ...details });
}

function readCanonicalText(block: Uint8Array, offset: number, length: number, field: string): string {
  const bytes = block.slice(offset, offset + length);
  const nul = bytes.indexOf(0);
  const bounded = nul === -1 ? bytes : bytes.slice(0, nul);
  if (nul !== -1 && !allZero(bytes.slice(nul))) {
    invalidHeaderField(field, `Archive ${field} contains non-zero bytes after its terminator.`);
  }
  try {
    return textDecoder.decode(bounded);
  } catch {
    invalidHeaderField(field, `Archive ${field} contains invalid UTF-8.`);
  }
}

function readCanonicalOctal(block: Uint8Array, offset: number, length: number, field: string): number {
  const bytes = block.slice(offset, offset + length);
  if (bytes[length - 1] !== 0 || bytes.slice(0, -1).some((byte) => byte < 0x30 || byte > 0x37)) {
    invalidHeaderField(field, `Archive ${field} does not use the canonical zero-padded octal encoding.`, {
      encoding: Buffer.from(bytes).toString("hex")
    });
  }
  const value = Buffer.from(bytes.slice(0, -1)).toString("ascii");
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    invalidHeaderField(field, `Archive ${field} is outside the safe integer range.`, { value });
  }
  return parsed;
}

function readCanonicalChecksum(block: Uint8Array): number {
  const bytes = block.slice(148, 156);
  if (
    bytes[6] !== 0 ||
    bytes[7] !== 0x20 ||
    bytes.slice(0, 6).some((byte) => byte < 0x30 || byte > 0x37)
  ) {
    invalidHeaderField("checksum", "Archive checksum does not use the canonical USTAR encoding.", {
      encoding: Buffer.from(bytes).toString("hex")
    });
  }
  return Number.parseInt(Buffer.from(bytes.slice(0, 6)).toString("ascii"), 8);
}

function assertExactBytes(
  block: Uint8Array,
  offset: number,
  expected: Uint8Array,
  field: string,
  message: string
): void {
  const observed = block.slice(offset, offset + expected.length);
  if (observed.length !== expected.length || observed.some((byte, index) => byte !== expected[index])) {
    invalidHeaderField(field, message, {
      expected: Buffer.from(expected).toString("hex"),
      observed: Buffer.from(observed).toString("hex")
    });
  }
}

function assertZeroField(block: Uint8Array, offset: number, length: number, field: string): void {
  const observed = block.slice(offset, offset + length);
  if (!allZero(observed)) {
    invalidHeaderField(field, `Archive ${field} must be empty in dokion-package-tar-v1.`, {
      observed: Buffer.from(observed).toString("hex")
    });
  }
}

function verifyHeaderChecksum(block: Uint8Array): void {
  const expected = readCanonicalChecksum(block);
  const copy = Uint8Array.from(block);
  copy.fill(0x20, 148, 156);
  const observed = copy.reduce((total, byte) => total + byte, 0);
  if (expected !== observed) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive header checksum mismatch.", {
      field: "checksum",
      expected,
      observed
    });
  }
}

function validateCanonicalHeader(block: Uint8Array): number {
  const mode = readCanonicalOctal(block, 100, 8, "mode");
  if (mode !== 0o644) invalidHeaderField("mode", "Archive file mode must be exactly 0644.", { expected: 0o644, observed: mode });

  const uid = readCanonicalOctal(block, 108, 8, "uid");
  if (uid !== 0) invalidHeaderField("uid", "Archive UID must be zero.", { expected: 0, observed: uid });

  const gid = readCanonicalOctal(block, 116, 8, "gid");
  if (gid !== 0) invalidHeaderField("gid", "Archive GID must be zero.", { expected: 0, observed: gid });

  const size = readCanonicalOctal(block, 124, 12, "size");
  const mtime = readCanonicalOctal(block, 136, 12, "mtime");
  if (mtime !== 0) invalidHeaderField("mtime", "Archive modification time must be zero.", { expected: 0, observed: mtime });

  assertExactBytes(block, 156, Buffer.from("0", "ascii"), "typeflag", "Archive typeflag must identify a regular file.");
  assertZeroField(block, 157, 100, "linkname");
  assertExactBytes(block, 257, Buffer.from("ustar\0", "ascii"), "magic", "Archive magic must be canonical USTAR.");
  assertExactBytes(block, 263, Buffer.from("00", "ascii"), "version", "Archive USTAR version must be 00.");
  assertZeroField(block, 265, 32, "uname");
  assertZeroField(block, 297, 32, "gname");

  const deviceMajor = readCanonicalOctal(block, 329, 8, "device_major");
  if (deviceMajor !== 0) {
    invalidHeaderField("device_major", "Archive device major must be zero.", { expected: 0, observed: deviceMajor });
  }
  const deviceMinor = readCanonicalOctal(block, 337, 8, "device_minor");
  if (deviceMinor !== 0) {
    invalidHeaderField("device_minor", "Archive device minor must be zero.", { expected: 0, observed: deviceMinor });
  }
  assertZeroField(block, 500, 12, "header_padding");
  return size;
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
  const paths = new PackagePathRegistry();
  let totalPayloadBytes = 0;
  let offset = 0;
  let terminated = false;
  let previousPath: string | undefined;

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
    const size = validateCanonicalHeader(header);
    const name = readCanonicalText(header, 0, 100, "name");
    const prefix = readCanonicalText(header, 345, 155, "prefix");
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const canonicalSplit = splitUstarPath(archivePath);
    if (canonicalSplit.name !== name || canonicalSplit.prefix !== prefix) {
      invalidHeaderField("path_split", "Archive path does not use the canonical USTAR name and prefix split.", {
        archivePath,
        expectedName: canonicalSplit.name,
        expectedPrefix: canonicalSplit.prefix
      });
    }

    const packagePath = packagePathFromArchiveEntry(archivePath);
    if (archivePathForPackageFile(packagePath) !== archivePath) {
      invalidHeaderField("path", "Archive path is not in canonical normalized form.", { archivePath, packagePath });
    }
    const path = paths.add(packagePath);
    if (previousPath !== undefined && compareUtf8Bytes(previousPath, path) > 0) {
      throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Archive entries are not in canonical bytewise UTF-8 order.", {
        field: "entry_order",
        previousPath,
        path
      });
    }
    previousPath = path;

    if (paths.size > REGISTRY_PACKAGE_LIMITS.maximumFiles) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_MANY_FILES", "Package archive exceeds the file-count bound.", {
        count: paths.size,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFiles
      });
    }

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
