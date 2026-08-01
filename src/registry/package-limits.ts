export const REGISTRY_PACKAGE_LIMITS = Object.freeze({
  maximumArchiveBytes: 320 * 1024 * 1024,
  maximumFiles: 9_999,
  maximumFileBytes: 64 * 1024 * 1024,
  maximumTotalPayloadBytes: 256 * 1024 * 1024,
  archiveRootBytes: Buffer.byteLength("dokion-package/", "utf8"),
  maximumArchivePathBytes: 255,
  maximumPathBytes: 240,
  maximumPathSegmentBytes: 100,
  maximumManifestBytes: 4 * 1024 * 1024
});
