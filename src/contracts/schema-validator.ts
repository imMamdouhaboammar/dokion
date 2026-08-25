import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { join, relative } from "node:path";

import { builtinCatalog } from "../catalog/builtin-catalog.ts";
import { readJson } from "../core/json.ts";
import { embeddedSchemas } from "./embedded-schemas.ts";

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

export interface SchemaRegistry {
  manifest: ValidateFunction;
  playbook: ValidateFunction;
  coverageAssignment: ValidateFunction;
  stepInput: ValidateFunction;
  stepOutput: ValidateFunction;
  state: ValidateFunction;
  event: ValidateFunction;
  finding: ValidateFunction;
  capabilityLock: ValidateFunction;
}

let registryCache: Promise<SchemaRegistry> | undefined;

async function compileRegistry(): Promise<SchemaRegistry> {
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  for (const schema of Object.values(embeddedSchemas)) ajv.addSchema(schema);
  const compile = (schema: (typeof embeddedSchemas)[keyof typeof embeddedSchemas]): ValidateFunction => {
    const id = typeof schema === "object" && schema !== null && "$id" in schema ? String(schema.$id) : undefined;
    return (id ? ajv.getSchema(id) : undefined) ?? ajv.compile(schema);
  };

  return {
    manifest: compile(embeddedSchemas.manifest),
    playbook: compile(embeddedSchemas.playbook),
    coverageAssignment: compile(embeddedSchemas.coverageAssignment),
    stepInput: compile(embeddedSchemas.stepInput),
    stepOutput: compile(embeddedSchemas.stepOutput),
    state: compile(embeddedSchemas.state),
    event: compile(embeddedSchemas.event),
    finding: compile(embeddedSchemas.finding),
    capabilityLock: compile(embeddedSchemas.capabilityLock)
  };
}

async function buildRegistry(_root?: string): Promise<SchemaRegistry> {
  registryCache ??= compileRegistry().catch((error) => {
    registryCache = undefined;
    throw error;
  });
  return registryCache;
}

export function clearSchemaRegistryCache(_root?: string): void {
  registryCache = undefined;
}

function normalizeErrors(
  file: string,
  errors: ErrorObject[] | null | undefined,
  instancePrefix = ""
): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    file,
    message: error.message ?? "schema validation failed",
    instancePath: `${instancePrefix}${error.instancePath}`,
    schemaPath: error.schemaPath
  }));
}

async function collectJsonFiles(root: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  const glob = new Bun.Glob(pattern);
  for await (const path of glob.scan({ cwd: root, onlyFiles: true })) files.push(path);
  return files.sort();
}

interface CoverageExtension {
  kind: "coverage";
  value: unknown;
  path: string;
}

interface StepInputExtension {
  kind: "step-input";
  value: unknown;
  path: string;
}

interface StepOutputExtension {
  kind: "step-output";
  value: unknown;
  path: string;
}

type PlaybookExtension = CoverageExtension | StepInputExtension | StepOutputExtension;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typedBindingPlaceholder(value: Record<string, unknown>, fallback: string): string {
  return typeof value.name === "string" && value.name.length > 0 ? value.name : fallback;
}

function extractPlaybookExtensions(data: unknown): { base: unknown; extensions: PlaybookExtension[] } {
  if (!isRecord(data)) {
    return { base: data, extensions: [] };
  }

  const base = structuredClone(data) as Record<string, unknown>;
  const extensions: PlaybookExtension[] = [];
  const stages = Array.isArray(base.stages) ? base.stages : [];
  for (const [stageIndex, stageValue] of stages.entries()) {
    if (!isRecord(stageValue)) continue;
    const steps = Array.isArray(stageValue.steps) ? stageValue.steps : [];
    for (const [stepIndex, stepValue] of steps.entries()) {
      if (!isRecord(stepValue)) continue;

      if ("coverage_lanes" in stepValue) {
        const assignments = stepValue.coverage_lanes;
        if (Array.isArray(assignments)) {
          for (const [assignmentIndex, assignment] of assignments.entries()) {
            extensions.push({
              kind: "coverage",
              value: assignment,
              path: `/stages/${stageIndex}/steps/${stepIndex}/coverage_lanes/${assignmentIndex}`
            });
          }
        } else {
          extensions.push({
            kind: "coverage",
            value: assignments,
            path: `/stages/${stageIndex}/steps/${stepIndex}/coverage_lanes`
          });
        }
        delete stepValue.coverage_lanes;
      }

      if (Array.isArray(stepValue.inputs)) {
        stepValue.inputs = stepValue.inputs.map((input, inputIndex) => {
          if (!isRecord(input)) return input;
          extensions.push({
            kind: "step-input",
            value: input,
            path: `/stages/${stageIndex}/steps/${stepIndex}/inputs/${inputIndex}`
          });
          return typedBindingPlaceholder(input, `typed-input-${inputIndex}`);
        });
      }

      if (Array.isArray(stepValue.outputs)) {
        stepValue.outputs = stepValue.outputs.map((output, outputIndex) => {
          if (!isRecord(output)) return output;
          extensions.push({
            kind: "step-output",
            value: output,
            path: `/stages/${stageIndex}/steps/${stepIndex}/outputs/${outputIndex}`
          });
          return typedBindingPlaceholder(output, `typed-output-${outputIndex}`);
        });
      }
    }
  }
  return { base, extensions };
}

export async function validatePlaybookData(
  root: string,
  data: unknown,
  file = ".dokion/playbook.json"
): Promise<ValidationIssue[]> {
  const registry = await buildRegistry(root);
  const { base, extensions } = extractPlaybookExtensions(data);
  const issues = registry.playbook(base) ? [] : normalizeErrors(file, registry.playbook.errors);

  for (const extension of extensions) {
    const validator = extension.kind === "coverage"
      ? registry.coverageAssignment
      : extension.kind === "step-input"
        ? registry.stepInput
        : registry.stepOutput;
    if (!validator(extension.value)) {
      issues.push(...normalizeErrors(file, validator.errors, extension.path));
    }
  }
  return issues;
}

export async function validateStateData(_root: string, data: unknown, file = ".dokion/state.json"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry();
  return registry.state(data) ? [] : normalizeErrors(file, registry.state.errors);
}

export async function validateEventData(_root: string, data: unknown, file = ".dokion/events.ndjson"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry();
  return registry.event(data) ? [] : normalizeErrors(file, registry.event.errors);
}

export async function validateFindingData(_root: string, data: unknown, file = ".dokion/findings/unknown.json"): Promise<ValidationIssue[]> {
  const registry = await buildRegistry();
  return registry.finding(data) ? [] : normalizeErrors(file, registry.finding.errors);
}

export async function validateRepositoryContracts(root: string): Promise<ValidationSummary> {
  const registry = await buildRegistry();
  const checkedFiles: string[] = [];
  const errors: ValidationIssue[] = [];

  const validateData = (path: string, data: unknown, validator: ValidateFunction): void => {
    checkedFiles.push(path);
    if (!validator(data)) errors.push(...normalizeErrors(path, validator.errors));
  };

  const validateFile = async (path: string, validator: ValidateFunction): Promise<void> => {
    validateData(path, await readJson<unknown>(join(root, path)), validator);
  };

  const validatePlaybookFile = async (path: string): Promise<void> => {
    const data = await readJson<unknown>(join(root, path));
    checkedFiles.push(path);
    errors.push(...(await validatePlaybookData(root, data, path)));
  };

  if (await Bun.file(join(root, "dokion.json")).exists()) {
    await validateFile("dokion.json", registry.manifest);
  } else {
    validateData("builtin:dokion.json", builtinCatalog, registry.manifest);
  }

  for (const path of await collectJsonFiles(root, "playbooks/**/*.json")) {
    await validatePlaybookFile(path);
  }

  for (const path of [".dokion/playbook.json", ".dokion/playbook.proposed.json"]) {
    if (await Bun.file(join(root, path)).exists()) {
      await validatePlaybookFile(path);
    }
  }

  const optionalRuntimeFiles: Array<[string, ValidateFunction]> = [
    [".dokion/state.json", registry.state],
    [".dokion/capabilities.lock.json", registry.capabilityLock]
  ];

  for (const [path, validator] of optionalRuntimeFiles) {
    if (await Bun.file(join(root, path)).exists()) await validateFile(path, validator);
  }

  for (const path of await collectJsonFiles(root, ".dokion/findings/**/*.json")) await validateFile(path, registry.finding);

  return {
    valid: errors.length === 0,
    checkedFiles: checkedFiles.map((path) => (path.startsWith("builtin:") ? path : relative(root, join(root, path)))),
    errors
  };
}
