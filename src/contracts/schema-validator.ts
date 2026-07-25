import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { join, relative, resolve } from "node:path";

import { readJson } from "../core/json.ts";

export interface ValidationIssue {
  file: string;
  message: string;
  instancePath: string;
  schemaPath: string;
}

export interface ValidationSummary {
  valid: boolean;
  checkedFiles: string[];
  errors: ValidationIssue[];
}

interface SchemaRegistry {
  manifest: ValidateFunction;
  playbook: ValidateFunction;
  state: ValidateFunction;
  finding: ValidateFunction;
  capabilityLock: ValidateFunction;
}

const schemaNames = {
  manifest: "dokion-manifest.schema.json",
  playbook: "dokion-playbook.schema.json",
  state: "dokion-state.schema.json",
  finding: "dokion-finding.schema.json",
  capabilityLock: "capability-lock.schema.json"
} as const;

const registryCache = new Map<string, Promise<SchemaRegistry>>();

async function compileRegistry(root: string): Promise<SchemaRegistry> {
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  const loaded = new Map<string, AnySchema>();
  for (const filename of Object.values(schemaNames)) {
    const schema = await readJson<AnySchema>(join(root, "schemas", filename));
    loaded.set(filename, schema);
    ajv.addSchema(schema);
  }

  const compile = (filename: string): ValidateFunction => {
    const schema = loaded.get(filename);
    if (!schema) {
      throw new Error(`Schema was not loaded: ${filename}`);
    }
    const id = typeof schema === "object" && schema !== null && "$id" in schema ? String(schema.$id) : undefined;
    return (id ? ajv.getSchema(id) : undefined) ?? ajv.compile(schema);
  };

  return {
    manifest: compile(schemaNames.manifest),
    playbook: compile(schemaNames.playbook),
    state: compile(schemaNames.state),
    finding: compile(schemaNames.finding),
    capabilityLock: compile(schemaNames.capabilityLock)
  };
}

async function buildRegistry(root: string): Promise<SchemaRegistry> {
  const key = resolve(root);
  const cached = registryCache.get(key);
  if (cached) {
    return cached;
  }

  const compiling = compileRegistry(key).catch((error) => {
    registryCache.delete(key);
    throw error;
  });
  registryCache.set(key, compiling);
  return compiling;
}

export function clearSchemaRegistryCache(root?: string): void {
  if (root) {
    registryCache.delete(resolve(root));
    return;
  }
  registryCache.clear();
}

function normalizeErrors(file: string, errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    file,
    message: error.message ?? "schema validation failed",
    instancePath: error.instancePath,
    schemaPath: error.schemaPath
  }));
}

async function collectJsonFiles(root: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  const glob = new Bun.Glob(pattern);
  for await (const path of glob.scan({ cwd: root, onlyFiles: true })) {
    files.push(path);
  }
  return files.sort();
}

export async function validatePlaybookData(root: string, data: unknown, file = ".dokion/playbook.json"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry(root);
  return registry.playbook(data) ? [] : normalizeErrors(file, registry.playbook.errors);
}

export async function validateStateData(root: string, data: unknown, file = ".dokion/state.json"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry(root);
  return registry.state(data) ? [] : normalizeErrors(file, registry.state.errors);
}

export async function validateFindingData(root: string, data: unknown, file = ".dokion/findings/unknown.json"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry(root);
  return registry.finding(data) ? [] : normalizeErrors(file, registry.finding.errors);
}

export async function validateRepositoryContracts(root: string): Promise<ValidationSummary> {
  const registry = await buildRegistry(root);
  const checkedFiles: string[] = [];
  const errors: ValidationIssue[] = [];

  const validateFile = async (path: string, validator: ValidateFunction): Promise<void> => {
    const data = await readJson<unknown>(join(root, path));
    checkedFiles.push(path);
    if (!validator(data)) {
      errors.push(...normalizeErrors(path, validator.errors));
    }
  };

  await validateFile("dokion.json", registry.manifest);

  for (const path of await collectJsonFiles(root, "playbooks/**/*.json")) {
    await validateFile(path, registry.playbook);
  }

  const optionalRuntimeFiles: Array<[string, ValidateFunction]> = [
    [".dokion/playbook.json", registry.playbook],
    [".dokion/playbook.proposed.json", registry.playbook],
    [".dokion/state.json", registry.state],
    [".dokion/capabilities.lock.json", registry.capabilityLock]
  ];

  for (const [path, validator] of optionalRuntimeFiles) {
    if (await Bun.file(join(root, path)).exists()) {
      await validateFile(path, validator);
    }
  }

  for (const path of await collectJsonFiles(root, ".dokion/findings/**/*.json")) {
    await validateFile(path, registry.finding);
  }

  return {
    valid: errors.length === 0,
    checkedFiles: checkedFiles.map((path) => relative(root, join(root, path))),
    errors
  };
}
