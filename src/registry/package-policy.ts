import { basename } from "node:path";

import { DokionError } from "../core/errors.ts";
import { compareUtf8Bytes } from "./digests.ts";

const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "preprepare",
  "postprepare",
  "prepublish",
  "prepublishOnly",
  "publish",
  "postpublish",
  "prepack",
  "postpack"
]);

export function rejectPackageLifecycleScripts(path: string, bytes: Uint8Array): void {
  if (basename(path).toLowerCase() !== "package.json") return;

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", `Declared package.json is not valid UTF-8 JSON: ${path}`, {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  const scripts = (value as Record<string, unknown>).scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return;
  const lifecycle = Object.keys(scripts as Record<string, unknown>)
    .filter((name) => LIFECYCLE_SCRIPTS.has(name))
    .sort(compareUtf8Bytes);
  if (lifecycle.length > 0) {
    throw new DokionError("REGISTRY_PACKAGE_LIFECYCLE_SCRIPT", `Lifecycle scripts are forbidden in Registry packages: ${path}`, {
      path,
      scripts: lifecycle
    });
  }
}
