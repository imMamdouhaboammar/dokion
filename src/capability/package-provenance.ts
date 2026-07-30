import { DokionError } from "../core/errors.ts";

export interface InstallerExceptionApproval {
  by: string;
  at: string;
}

export interface InstallerExceptionInput {
  reason: string;
  approval: InstallerExceptionApproval;
}

export interface PackageProvenanceInput {
  capabilityId: string;
  packageManager: string;
  registry: string;
  packageName: string;
  version: string;
  integrity: string;
  installerCommand: string;
  installerException?: InstallerExceptionInput;
  verifier: {
    identity: string;
    verifiedAt: string;
  };
}

export interface PackageProvenanceRecord {
  schema_version: 1;
  capability_id: string;
  package_manager: string;
  registry: string;
  package: {
    name: string;
    version: string;
    integrity: string;
  };
  installer: {
    command: string;
  };
  verifier: {
    identity: string;
    verified_at: string;
  };
  installer_exception?: {
    preferred_package_manager: "bun";
    used_package_manager: string;
    reason: string;
    approved_by: string;
    approved_at: string;
  };
  redacted_fields: string[];
}

const PACKAGE_MANAGER = /^[a-z][a-z0-9._-]*$/;
const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;
const VERSION = /^v?\d+(?:\.\d+){1,3}(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const INTEGRITY = /^(?:sha256:[a-fA-F0-9]{64}|sha512:[a-fA-F0-9]{128}|(?:sha256|sha512)-[A-Za-z0-9+/]+={0,2})$/;

function requireText(field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DokionError("INVALID_STATE", `Package provenance requires ${field}`, { field });
  }
  return normalized;
}

function requireDate(field: string, value: string): string {
  const normalized = requireText(field, value);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new DokionError("INVALID_STATE", `Package provenance requires a valid ${field}`, { field });
  }
  return normalized;
}

function sanitizeRegistry(value: string): { value: string; redacted: boolean } {
  const normalized = requireText("registry", value);
  let registry: URL;
  try {
    registry = new URL(normalized);
  } catch {
    throw new DokionError("INVALID_STATE", "Package provenance requires an absolute registry URL", {
      field: "registry"
    });
  }
  if (registry.protocol !== "https:" && registry.protocol !== "http:") {
    throw new DokionError("INVALID_STATE", "Package registry must use HTTP or HTTPS", {
      field: "registry"
    });
  }

  const redacted = Boolean(registry.username || registry.password || registry.search || registry.hash);
  registry.username = "";
  registry.password = "";
  registry.search = "";
  registry.hash = "";
  return { value: registry.toString(), redacted };
}

function sanitizeCommand(value: string): { value: string; redacted: boolean } {
  let command = requireText("installer command", value);
  let redacted = false;

  const replace = (pattern: RegExp, replacement: string): void => {
    const next = command.replace(pattern, replacement);
    if (next !== command) redacted = true;
    command = next;
  };

  replace(
    /(^|\s)([A-Za-z_][A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTH)[A-Za-z0-9_]*)=(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
    "$1$2=[REDACTED]"
  );
  replace(
    /(--(?:token|password|api-key|auth|_authToken))(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
    "$1 [REDACTED]"
  );
  replace(/(\b_?authToken\s*=\s*)[^\s]+/gi, "$1[REDACTED]");
  replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]");

  command = command.replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => {
    try {
      const url = new URL(candidate);
      const changed = Boolean(url.username || url.password || url.search || url.hash);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      if (changed) redacted = true;
      return url.toString();
    } catch {
      return candidate;
    }
  });

  return { value: command, redacted };
}

function validatePackageIdentity(input: PackageProvenanceInput): {
  capabilityId: string;
  packageManager: string;
  packageName: string;
  version: string;
  integrity: string;
} {
  const capabilityId = requireText("capability id", input.capabilityId);
  const packageManager = requireText("package manager", input.packageManager);
  const packageName = requireText("package name", input.packageName);
  const version = requireText("package version", input.version);
  const integrity = requireText("package integrity", input.integrity);

  if (!PACKAGE_MANAGER.test(packageManager)) {
    throw new DokionError("INVALID_STATE", "Package manager identifier is invalid", { field: "packageManager" });
  }
  if (!PACKAGE_NAME.test(packageName)) {
    throw new DokionError("INVALID_STATE", "Package name is invalid", { field: "packageName" });
  }
  if (!VERSION.test(version)) {
    throw new DokionError("INVALID_STATE", "Package version is invalid", { field: "version" });
  }
  if (!INTEGRITY.test(integrity)) {
    throw new DokionError("INVALID_STATE", "Package integrity is not immutable", { field: "integrity" });
  }
  return { capabilityId, packageManager, packageName, version, integrity };
}

function installerException(
  packageManager: string,
  input: InstallerExceptionInput | undefined
): PackageProvenanceRecord["installer_exception"] {
  if (packageManager === "bun") {
    if (input !== undefined) {
      throw new DokionError("INVALID_STATE", "Bun installation must not record an installer exception", {
        field: "installerException"
      });
    }
    return undefined;
  }

  if (input === undefined) {
    throw new DokionError("APPROVAL_REQUIRED", "Non-Bun package installation requires an approved exception", {
      packageManager
    });
  }

  const reason = requireText("installer exception reason", input.reason);
  const approvedBy = requireText("installer exception approver", input.approval.by);
  const approvedAt = requireDate("installer exception approval time", input.approval.at);
  return {
    preferred_package_manager: "bun",
    used_package_manager: packageManager,
    reason,
    approved_by: approvedBy,
    approved_at: approvedAt
  };
}

export function recordPackageProvenance(input: PackageProvenanceInput): PackageProvenanceRecord {
  const identity = validatePackageIdentity(input);
  const registry = sanitizeRegistry(input.registry);
  const installer = sanitizeCommand(input.installerCommand);
  const verifiedBy = requireText("verifier identity", input.verifier.identity);
  const verifiedAt = requireDate("verification time", input.verifier.verifiedAt);
  const exception = installerException(identity.packageManager, input.installerException);
  const redactedFields = [
    ...(registry.redacted ? ["registry"] : []),
    ...(installer.redacted ? ["installer.command"] : [])
  ].sort();

  return {
    schema_version: 1,
    capability_id: identity.capabilityId,
    package_manager: identity.packageManager,
    registry: registry.value,
    package: {
      name: identity.packageName,
      version: identity.version,
      integrity: identity.integrity
    },
    installer: { command: installer.value },
    verifier: {
      identity: verifiedBy,
      verified_at: verifiedAt
    },
    ...(exception ? { installer_exception: exception } : {}),
    redacted_fields: redactedFields
  };
}
