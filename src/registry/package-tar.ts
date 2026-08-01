import { DokionError } from "../core/errors.ts";
import { compareUtf8Bytes } from "./digests.ts";
import {
  archivePathForPackageFile,
  PackagePathRegistry,
  packagePathFromArchiveEntry,
  splitUstarPath
} from "./package-paths.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";

const BLOCK_SIZE = 512;
const TERMINAL_SIZE = BLOCK_SIZE * 2;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

export interface RegistryTarEntry {
  path: string;
  bytes: Uint8Array;
}

function fail(field: string, message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", message, { field, ...details });
}

function allZero(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte === 0);
}

function putText(block: Uint8Array, offset: number, length: number, value: string): void {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.length > length) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", "Value does not fit in a deterministic USTAR field.", {
      value,
      maximumBytes: length
    });
  }
  block.set(encoded, offset);
}

function putOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail("numeric", "USTAR numeric fields require non-negative safe integers.", { value });
  }
  const encoded = `${value.toString(8).padStart(length - 1, "0")}\0`;
  if (encoded.length !== length) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "USTAR numeric field overflow.", {
      value,
      fieldBytes: length
    });
  }
  putText(block, offset, length, encoded);
}

function headerFor(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE);
  const { name, prefix } = splitUstarPath(path);
  putText(block, 0, 100, name);
  putOctal(block, 100, 8, 0o644);
  putOctal(block, 108, 8, 0);
  putOctal(block, 116, 8, 0);
  putOctal(block, 124, 12, size);
  putOctal(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  putText(block, 156, 1, "0");
  putText(block, 257, 6, "ustar\0");
  putText(block, 263, 2, "00");
  putOctal(block, 329, 8, 0);
  putOctal(block, 337, 8, 0);
  putText(block, 345, 155, prefix);

  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  const encodedChecksum = `${checksum.toString(8).padStart(6, "0")}\0 `;
  if (encodedChecksum.length !== 8) fail("checksum", "USTAR checksum overflow.", { path, checksum });
  putText(block, 148, 8, encodedChecksum);
  return block;
}

export function createDeterministicPackageTar(entries: readonly RegistryTarEntry[]): Uint8Array {
  if (entries.length === 0 || entries.length > REGISTRY_PACKAGE_LIMITS.maximumFiles) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_MANY_FILES", "Package archive file count is outside the supported bound.", {
      count: entries.length,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumFiles
    });
  }

  const registry = new PackagePathRegistry();
  const sorted = entries
    .map((entry) => ({ path: registry.add(entry.path), bytes: Uint8Array.from(entry.bytes) }))
    .sort((left, right) => compareUtf8Bytes(left.path, right.path));

  let payloadSize = 0;
  let archiveSize = TERMINAL_SIZE;
  for (const entry of sorted) {
    if (entry.bytes.length > REGISTRY_PACKAGE_LIMITS.maximumFileBytes) {
      throw new DokionError("REGISTRY_PACKAGE_FILE_TOO_LARGE", `Package file exceeds the individual size bound: ${entry.path}`, {
        path: entry.path,
        size: entry.bytes.length,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFileBytes
      });
    }
    payloadSize += entry.bytes.length;
    if (payloadSize > REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package payload exceeds the total unpacked size bound.", {
        size: payloadSize,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes
      });
    }
    archiveSize += BLOCK_SIZE + Math.ceil(entry.bytes.length / BLOCK_SIZE) * BLOCK_SIZE;
  }
  if (archiveSize > REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package archive exceeds the archive size bound.", {
      size: archiveSize,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes
    });
  }

  const archive = new Uint8Array(archiveSize);
  let offset = 0;
  for (const entry of sorted) {
    archive.set(headerFor(archivePathForPackageFile(entry.path), entry.bytes.length), offset);
    offset += BLOCK_SIZE;
    archive.set(entry.bytes, offset);
    offset += Math.ceil(entry.bytes.length / BLOCK_SIZE) * BLOCK_SIZE;
  }
  return archive;
}

function canonicalText(block: Uint8Array, offset: number, length: number, field: string): string {
  const bytes = block.slice(offset, offset + length);
  const terminator = bytes.indexOf(0);
  const content = terminator === -1 ? bytes : bytes.slice(0, terminator);
  if (terminator !== -1 && !allZero(bytes.slice(terminator))) {
    fail(field, `Archive ${field} contains non-zero bytes after its terminator.`);
  }
  try {
    return UTF8.decode(content);
  } catch {
    fail(field, `Archive ${field} contains invalid UTF-8.`);
  }
}

function canonicalOctal(block: Uint8Array, offset: number, length: number, field: string): number {
  const bytes = block.slice(offset, offset + length);
  if (bytes[length - 1] !== 0 || bytes.slice(0, -1).some((byte) => byte < 0x30 || byte > 0x37)) {
    fail(field, `Archive ${field} does not use canonical zero-padded octal encoding.`, {
      encoding: Buffer.from(bytes).toString("hex")
    });
  }
  const value = Number.parseInt(Buffer.from(bytes.slice(0, -1)).toString("ascii"), 8);
  if (!Number.isSafeInteger(value) || value < 0) fail(field, `Archive ${field} is outside the safe integer range.`);
  return value;
}

function requireBytes(block: Uint8Array, offset: number, expected: Uint8Array, field: string, message: string): void {
  const observed = block.slice(offset, offset + expected.length);
  if (observed.some((byte, index) => byte !== expected[index])) {
    fail(field, message, {
      expected: Buffer.from(expected).toString("hex"),
      observed: Buffer.from(observed).toString("hex")
    });
  }
}

function requireZero(block: Uint8Array, offset: number, length: number, field: string): void {
  const observed = block.slice(offset, offset + length);
  if (!allZero(observed)) fail(field, `Archive ${field} must be empty.`, { observed: Buffer.from(observed).toString("hex") });
}

function verifyChecksum(block: Uint8Array): void {
  const encoded = block.slice(148, 156);
  if (
    encoded[6] !== 0 ||
    encoded[7] !== 0x20 ||
    encoded.slice(0, 6).some((byte) => byte < 0x30 || byte > 0x37)
  ) {
    fail("checksum", "Archive checksum does not use canonical USTAR encoding.", {
      encoding: Buffer.from(encoded).toString("hex")
    });
  }
  const expected = Number.parseInt(Buffer.from(encoded.slice(0, 6)).toString("ascii"), 8);
  const copy = Uint8Array.from(block);
  copy.fill(0x20, 148, 156);
  const observed = copy.reduce((sum, byte) => sum + byte, 0);
  if (expected !== observed) fail("checksum", "Archive header checksum mismatch.", { expected, observed });
}

function validateHeader(block: Uint8Array): number {
  const mode = canonicalOctal(block, 100, 8, "mode");
  if (mode !== 0o644) fail("mode", "Archive file mode must be exactly 0644.", { expected: 0o644, observed: mode });
  const uid = canonicalOctal(block, 108, 8, "uid");
  if (uid !== 0) fail("uid", "Archive UID must be zero.", { observed: uid });
  const gid = canonicalOctal(block, 116, 8, "gid");
  if (gid !== 0) fail("gid", "Archive GID must be zero.", { observed: gid });
  const size = canonicalOctal(block, 124, 12, "size");
  const mtime = canonicalOctal(block, 136, 12, "mtime");
  if (mtime !== 0) fail("mtime", "Archive modification time must be zero.", { observed: mtime });

  const typeFlag = block[156];
  if (typeFlag !== 0x30) {
    throw new DokionError("REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED", "Package archive entries must be regular files.", {
      field: "typeflag",
      typeFlag: typeFlag === undefined ? null : String.fromCharCode(typeFlag)
    });
  }
  requireZero(block, 157, 100, "linkname");
  requireBytes(block, 257, Buffer.from("ustar\0", "ascii"), "magic", "Archive magic must be canonical USTAR.");
  requireBytes(block, 263, Buffer.from("00", "ascii"), "version", "Archive USTAR version must be 00.");
  requireZero(block, 265, 32, "uname");
  requireZero(block, 297, 32, "gname");
  const deviceMajor = canonicalOctal(block, 329, 8, "device_major");
  if (deviceMajor !== 0) fail("device_major", "Archive device major must be zero.", { observed: deviceMajor });
  const deviceMinor = canonicalOctal(block, 337, 8, "device_minor");
  if (deviceMinor !== 0) fail("device_minor", "Archive device minor must be zero.", { observed: deviceMinor });
  requireZero(block, 500, 12, "header_padding");
  return size;
}

function rejectCompression(bytes: Uint8Array): void {
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
  rejectCompression(bytes);
  if (bytes.length > REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package archive exceeds the archive size bound.", {
      size: bytes.length,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes
    });
  }
  if (bytes.length < TERMINAL_SIZE || bytes.length % BLOCK_SIZE !== 0) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Package archive must be a block-aligned USTAR stream.", {
      size: bytes.length
    });
  }

  const entries: RegistryTarEntry[] = [];
  const paths = new PackagePathRegistry();
  let totalPayload = 0;
  let previousPath: string | undefined;
  let offset = 0;
  let terminated = false;

  while (offset + BLOCK_SIZE <= bytes.length) {
    const header = bytes.slice(offset, offset + BLOCK_SIZE);
    if (allZero(header)) {
      const second = bytes.slice(offset + BLOCK_SIZE, offset + TERMINAL_SIZE);
      if (second.length !== BLOCK_SIZE || !allZero(second)) {
        fail("termination", "Archive termination requires two zero blocks.");
      }
      if (!allZero(bytes.slice(offset + TERMINAL_SIZE))) fail("trailing", "Archive contains data after terminal blocks.");
      terminated = true;
      break;
    }

    verifyChecksum(header);
    const size = validateHeader(header);
    const name = canonicalText(header, 0, 100, "name");
    const prefix = canonicalText(header, 345, 155, "prefix");
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const expectedSplit = splitUstarPath(archivePath);
    if (expectedSplit.name !== name || expectedSplit.prefix !== prefix) {
      fail("path_split", "Archive path does not use the canonical USTAR name and prefix split.", {
        archivePath,
        expectedName: expectedSplit.name,
        expectedPrefix: expectedSplit.prefix
      });
    }

    const path = paths.add(packagePathFromArchiveEntry(archivePath));
    if (archivePathForPackageFile(path) !== archivePath) fail("path", "Archive path is not canonically normalized.", { archivePath, path });
    if (previousPath !== undefined && compareUtf8Bytes(previousPath, path) > 0) {
      fail("entry_order", "Archive entries are not in canonical bytewise UTF-8 order.", { previousPath, path });
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
    totalPayload += size;
    if (totalPayload > REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package payload exceeds the total unpacked size bound.", {
        size: totalPayload,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes
      });
    }

    const payloadStart = offset + BLOCK_SIZE;
    const payloadEnd = payloadStart + size;
    const nextOffset = payloadStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    if (payloadEnd > bytes.length || nextOffset > bytes.length) fail("size", "Archive entry extends beyond available bytes.", { path, size });
    if (!allZero(bytes.slice(payloadEnd, nextOffset))) fail("padding", "Archive entry padding must be zero-filled.", { path });
    entries.push({ path, bytes: bytes.slice(payloadStart, payloadEnd) });
    offset = nextOffset;
  }

  if (!terminated) fail("termination", "Archive is missing terminal zero blocks.");
  if (entries.length === 0) fail("entries", "Package archive contains no files.");
  return entries;
}
