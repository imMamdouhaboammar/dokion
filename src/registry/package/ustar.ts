import { sha256 } from "../../core/digest.ts";
import { DokionError } from "../../core/errors.ts";
import type { PackageInspection, PackageLimits, TarInspectionEntry, TarSourceEntry } from "./types.ts";

const BLOCK_SIZE = 512;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface ParsedTarEntry extends TarInspectionEntry {
  bytes: Uint8Array;
}

export interface ParsedTarArchive {
  entries: ParsedTarEntry[];
  inspection: PackageInspection;
}

function copyField(header: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = encoder.encode(value);
  if (bytes.byteLength > length) {
    throw new DokionError("PACKAGE_SOURCE_INVALID", "USTAR field exceeds its byte limit", {
      value,
      bytes: bytes.byteLength,
      maximum: length
    });
  }
  header.set(bytes, offset);
}

function writeOctal(header: Uint8Array, offset: number, length: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR numeric field is not a non-negative safe integer", {
      value
    });
  }
  const octal = value.toString(8);
  if (octal.length > length - 1) {
    throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "USTAR numeric field exceeds its encoded width", {
      value,
      length
    });
  }
  copyField(header, offset, length - 1, octal.padStart(length - 1, "0"));
  header[offset + length - 1] = 0;
}

function splitUstarPath(path: string): { name: string; prefix: string } {
  const pathBytes = encoder.encode(path);
  if (pathBytes.byteLength <= 100) return { name: path, prefix: "" };

  const slashIndexes: number[] = [];
  for (let index = 0; index < path.length; index += 1) {
    if (path[index] === "/") slashIndexes.push(index);
  }

  for (const index of slashIndexes.reverse()) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (encoder.encode(prefix).byteLength <= 155 && encoder.encode(name).byteLength <= 100) {
      return { name, prefix };
    }
  }

  throw new DokionError("PACKAGE_SOURCE_INVALID", "Package path cannot be represented by USTAR name and prefix fields", {
    path,
    bytes: pathBytes.byteLength
  });
}

function headerChecksum(header: Uint8Array): number {
  let checksum = 0;
  for (let index = 0; index < header.byteLength; index += 1) {
    checksum += index >= 148 && index < 156 ? 32 : header[index]!;
  }
  return checksum;
}

function createHeader(entry: TarSourceEntry): Uint8Array {
  const header = new Uint8Array(BLOCK_SIZE);
  const { name, prefix } = splitUstarPath(entry.path);

  copyField(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, entry.bytes.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(32, 148, 156);
  header[156] = "0".charCodeAt(0);
  copyField(header, 257, 6, "ustar\0");
  copyField(header, 263, 2, "00");
  copyField(header, 345, 155, prefix);

  const checksum = headerChecksum(header).toString(8).padStart(6, "0");
  copyField(header, 148, 6, checksum);
  header[154] = 0;
  header[155] = 32;
  return header;
}

function paddedSize(size: number): number {
  return Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
}

export function writeDeterministicUstar(entries: readonly TarSourceEntry[], limits: PackageLimits): Uint8Array {
  const seen = new Set<string>();
  let total = BLOCK_SIZE * 2;

  for (const entry of entries) {
    if (seen.has(entry.path)) {
      throw new DokionError("PACKAGE_SOURCE_INVALID", "Package archive contains a duplicate source path", {
        path: entry.path
      });
    }
    seen.add(entry.path);
    total += BLOCK_SIZE + paddedSize(entry.bytes.byteLength);
    if (total > limits.maximumArchiveBytes) {
      throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Package archive exceeds the maximum byte limit", {
        bytes: total,
        maximum: limits.maximumArchiveBytes
      });
    }
  }

  const archive = new Uint8Array(total);
  let offset = 0;
  for (const entry of entries) {
    archive.set(createHeader(entry), offset);
    offset += BLOCK_SIZE;
    archive.set(entry.bytes, offset);
    offset += paddedSize(entry.bytes.byteLength);
  }
  return archive;
}

function decodeField(block: Uint8Array, offset: number, length: number): string {
  const field = block.subarray(offset, offset + length);
  const end = field.indexOf(0);
  const bytes = end === -1 ? field : field.subarray(0, end);
  try {
    return decoder.decode(bytes);
  } catch (error) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR text field is not valid UTF-8", {
      offset,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseOctal(block: Uint8Array, offset: number, length: number, field: string): number {
  const raw = decodeField(block, offset, length).trim();
  if (!/^[0-7]+$/.test(raw)) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR numeric field is not canonical octal", {
      field,
      raw
    });
  }
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value)) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR numeric field exceeds safe integer range", {
      field,
      raw
    });
  }
  return value;
}

function isZeroBlock(block: Uint8Array): boolean {
  for (const value of block) if (value !== 0) return false;
  return true;
}

function assertSafeArchivePath(path: string, limits: PackageLimits): void {
  const bytes = encoder.encode(path).byteLength;
  if (bytes === 0 || bytes > limits.maximumPathBytes) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive path exceeds the package path limit", {
      path,
      bytes,
      maximum: limits.maximumPathBytes
    });
  }
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive contains an unsafe path", { path });
  }
}

export function parseBoundedUstar(archive: Uint8Array, limits: PackageLimits): ParsedTarArchive {
  if (archive.byteLength > limits.maximumArchiveBytes) {
    throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Package archive exceeds the maximum byte limit", {
      bytes: archive.byteLength,
      maximum: limits.maximumArchiveBytes
    });
  }
  if (archive.byteLength < BLOCK_SIZE * 2 || archive.byteLength % BLOCK_SIZE !== 0) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Package archive is not block-aligned USTAR", {
      bytes: archive.byteLength
    });
  }

  const entries: ParsedTarEntry[] = [];
  const seen = new Set<string>();
  let expandedBytes = 0;
  let offset = 0;
  let terminatedAt = -1;

  while (offset < archive.byteLength) {
    const header = archive.subarray(offset, offset + BLOCK_SIZE);
    if (isZeroBlock(header)) {
      const secondOffset = offset + BLOCK_SIZE;
      if (secondOffset + BLOCK_SIZE > archive.byteLength || !isZeroBlock(archive.subarray(secondOffset, secondOffset + BLOCK_SIZE))) {
        throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR archive must terminate with exactly two zero blocks", {
          offset
        });
      }
      terminatedAt = secondOffset + BLOCK_SIZE;
      if (terminatedAt !== archive.byteLength) {
        throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR archive contains trailing blocks after termination", {
          terminatedAt,
          archiveBytes: archive.byteLength
        });
      }
      break;
    }

    if (decodeField(header, 257, 6) !== "ustar") {
      throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive entry is not a USTAR header", { offset });
    }
    const storedChecksum = parseOctal(header, 148, 8, "checksum");
    const observedChecksum = headerChecksum(header);
    if (storedChecksum !== observedChecksum) {
      throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR header checksum does not match", {
        offset,
        expected: storedChecksum,
        observed: observedChecksum
      });
    }

    const name = decodeField(header, 0, 100);
    const prefix = decodeField(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    assertSafeArchivePath(path, limits);
    if (seen.has(path)) {
      throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive contains a duplicate path", { path });
    }
    seen.add(path);

    const typeFlag = header[156];
    if (typeFlag !== 0 && typeFlag !== "0".charCodeAt(0)) {
      throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive contains a non-regular entry", {
        path,
        typeFlag: String.fromCharCode(typeFlag ?? 0)
      });
    }

    const mode = parseOctal(header, 100, 8, "mode");
    const uid = parseOctal(header, 108, 8, "uid");
    const gid = parseOctal(header, 116, 8, "gid");
    const size = parseOctal(header, 124, 12, "size");
    const mtime = parseOctal(header, 136, 12, "mtime");
    if (size > limits.maximumFileBytes && path !== "manifest.json") {
      throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Archive entry exceeds the per-file byte limit", {
        path,
        size,
        maximum: limits.maximumFileBytes
      });
    }
    if (path === "manifest.json" && size > limits.maximumManifestBytes) {
      throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Package manifest exceeds its byte limit", {
        size,
        maximum: limits.maximumManifestBytes
      });
    }

    const dataOffset = offset + BLOCK_SIZE;
    const dataEnd = dataOffset + size;
    const nextOffset = dataOffset + paddedSize(size);
    if (dataEnd > archive.byteLength || nextOffset > archive.byteLength) {
      throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Archive entry payload is truncated", {
        path,
        size,
        available: Math.max(0, archive.byteLength - dataOffset)
      });
    }

    expandedBytes += size;
    if (expandedBytes > limits.maximumExpandedBytes + limits.maximumManifestBytes) {
      throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Archive exceeds the expanded byte limit", {
        expandedBytes,
        maximum: limits.maximumExpandedBytes + limits.maximumManifestBytes
      });
    }
    if (entries.length + 1 > limits.maximumFiles + 1) {
      throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Archive exceeds the maximum entry count", {
        maximum: limits.maximumFiles + 1
      });
    }

    const bytes = archive.slice(dataOffset, dataEnd);
    entries.push({
      path,
      type: "file",
      mode,
      uid,
      gid,
      mtime,
      size,
      headerOffset: offset,
      dataOffset,
      digest: sha256(bytes),
      bytes
    });
    offset = nextOffset;
  }

  if (terminatedAt === -1) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "USTAR archive has no terminating zero blocks");
  }

  return {
    entries,
    inspection: {
      entries: entries.map(({ bytes: _bytes, ...entry }) => entry),
      archiveBytes: archive.byteLength,
      expandedBytes,
      terminatedAt
    }
  };
}
