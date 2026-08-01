export interface ProtocolSemanticError {
  path: string;
  keyword: string;
  message: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function validatePackageManifest(document: JsonRecord): ProtocolSemanticError[] {
  const errors: ProtocolSemanticError[] = [];
  const files = Array.isArray(document.files) ? document.files : [];
  const seenPaths = new Map<string, number>();

  files.forEach((file, index) => {
    if (!isRecord(file)) return;
    const path = stringValue(file, "path");
    if (!path) return;
    const previousIndex = seenPaths.get(path);
    if (previousIndex !== undefined) {
      errors.push({
        path: `/files/${index}/path`,
        keyword: "duplicateFilePath",
        message: `Package path ${path} duplicates files[${previousIndex}].path.`
      });
      return;
    }
    seenPaths.set(path, index);
  });

  for (const field of ["playbook_path", "readme_path", "license_path"] as const) {
    const declaredPath = stringValue(document, field);
    if (declaredPath && !seenPaths.has(declaredPath)) {
      errors.push({
        path: `/${field}`,
        keyword: "declaredPathMissing",
        message: `${field} must reference a payload file listed in files[].path.`
      });
    }
  }

  return errors;
}

function validateRegistryConfig(document: JsonRecord): ProtocolSemanticError[] {
  const errors: ProtocolSemanticError[] = [];
  const sources = Array.isArray(document.sources) ? document.sources : [];
  const sourceNames = new Map<string, number>();
  const sourceIds = new Map<string, number>();

  sources.forEach((source, index) => {
    if (!isRecord(source)) return;
    const name = stringValue(source, "name");
    if (name) {
      const previousIndex = sourceNames.get(name);
      if (previousIndex !== undefined) {
        errors.push({
          path: `/sources/${index}/name`,
          keyword: "duplicateSourceName",
          message: `Registry source name ${name} duplicates sources[${previousIndex}].name.`
        });
      } else {
        sourceNames.set(name, index);
      }
    }

    const id = stringValue(source, "id");
    if (id) {
      const previousIndex = sourceIds.get(id);
      if (previousIndex !== undefined) {
        errors.push({
          path: `/sources/${index}/id`,
          keyword: "duplicateSourceId",
          message: `Registry source ID ${id} duplicates sources[${previousIndex}].id.`
        });
      } else {
        sourceIds.set(id, index);
      }
    }
  });

  return errors;
}

function validateIntegrityObservation(
  field: "manifest" | "artifact",
  observation: unknown
): ProtocolSemanticError[] {
  if (!isRecord(observation)) return [];

  const expectedDigest = stringValue(observation, "expected_digest");
  const observedDigest = stringValue(observation, "observed_digest");
  const integrityState = stringValue(observation, "integrity_state");
  if (!expectedDigest || !integrityState) return [];

  if (integrityState === "MATCH" && observedDigest !== expectedDigest) {
    return [{
      path: `/${field}/integrity_state`,
      keyword: "integrityStateMismatch",
      message: `${field}.integrity_state cannot be MATCH when expected and observed digests differ.`
    }];
  }

  if (integrityState === "MISMATCH" && observedDigest === expectedDigest) {
    return [{
      path: `/${field}/integrity_state`,
      keyword: "integrityStateMismatch",
      message: `${field}.integrity_state cannot be MISMATCH when expected and observed digests are equal.`
    }];
  }

  return [];
}

function validateProvenance(document: JsonRecord): ProtocolSemanticError[] {
  return [
    ...validateIntegrityObservation("manifest", document.manifest),
    ...validateIntegrityObservation("artifact", document.artifact)
  ];
}

export function validateRegistryDocumentSemantics(
  schemaName: string,
  document: unknown
): ProtocolSemanticError[] {
  if (!isRecord(document)) return [];

  switch (schemaName) {
    case "dokion.package-manifest.v1":
      return validatePackageManifest(document);
    case "dokion.registry-config.v1":
      return validateRegistryConfig(document);
    case "dokion.provenance.v1":
      return validateProvenance(document);
    default:
      return [];
  }
}
