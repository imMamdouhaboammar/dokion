import { DokionError } from "../core/errors.ts";
import type {
  DokionPlaybook,
  PlaybookArtifactKind,
  PlaybookInputBinding,
  PlaybookOutputDeclaration,
  PlaybookStep
} from "../playbook/types.ts";
import { readRunArtifact, type RunArtifactDescriptor } from "./run-artifact-store.ts";

export interface ResolvedStepInput {
  name: string;
  kind: PlaybookArtifactKind;
  required: boolean;
  producer: {
    step: string;
    output: string;
  };
  descriptor: RunArtifactDescriptor;
  blob_path: string;
}

export interface ResolvedStepInputs {
  inputs: ResolvedStepInput[];
  legacy_inputs: string[];
  missing_optional: string[];
}

export interface ResolveStepInputsOptions {
  root: string;
  runId: string;
  playbook: DokionPlaybook;
  step: PlaybookStep;
}

interface CanonicalProducer {
  stageId: string;
  step: PlaybookStep;
  output: PlaybookOutputDeclaration;
}

function canonicalStep(playbook: DokionPlaybook, stepId: string): PlaybookStep {
  const matches = playbook.stages
    .flatMap((stage) => stage.steps)
    .filter((candidate) => candidate.id === stepId);

  if (matches.length !== 1) {
    throw new DokionError(
      "ARTIFACT_INVALID",
      matches.length === 0
        ? `Step ${stepId} is not declared in the active Playbook.`
        : `Step ${stepId} is ambiguous in the active Playbook.`,
      { stepId, matches: matches.length }
    );
  }

  return matches[0]!;
}

function isTypedInput(input: string | PlaybookInputBinding): input is PlaybookInputBinding {
  return typeof input !== "string";
}

function isTypedOutput(output: string | PlaybookOutputDeclaration): output is PlaybookOutputDeclaration {
  return typeof output !== "string";
}

function canonicalProducer(
  playbook: DokionPlaybook,
  stepId: string,
  outputName: string
): CanonicalProducer {
  const matches = playbook.stages.flatMap((stage) => stage.steps
    .filter((step) => step.id === stepId)
    .map((step) => ({ stageId: stage.id, step })));

  if (matches.length !== 1) {
    throw new DokionError("ARTIFACT_INVALID", "Artifact producer must resolve to exactly one Playbook step.", {
      stepId,
      matches: matches.length
    });
  }

  const producer = matches[0]!;
  const outputs = (producer.step.outputs ?? [])
    .filter(isTypedOutput)
    .filter((output) => output.name === outputName);
  if (outputs.length !== 1) {
    throw new DokionError("ARTIFACT_INVALID", "Artifact producer output must resolve to exactly one typed declaration.", {
      stepId,
      outputName,
      matches: outputs.length
    });
  }

  return { ...producer, output: outputs[0]! };
}

function assertCanonicalProvenance(
  descriptor: RunArtifactDescriptor,
  producer: CanonicalProducer,
  consumerStep: string,
  inputName: string
): void {
  const expected = {
    stageId: producer.stageId,
    capabilityType: producer.step.capability.type,
    capabilityId: producer.step.capability.id,
    immutableReference: producer.step.capability.immutable_reference,
    kind: producer.output.kind,
    mediaType: producer.output.media_type,
    declaredSchema: producer.output.schema,
    sensitivity: producer.output.sensitivity ?? "INTERNAL",
    retention: producer.output.retention ?? "RUN"
  };
  const observed = {
    stageId: descriptor.producer.stage_id,
    capabilityType: descriptor.producer.capability.type,
    capabilityId: descriptor.producer.capability.id,
    immutableReference: descriptor.producer.capability.immutable_reference,
    kind: descriptor.kind,
    mediaType: descriptor.media_type,
    declaredSchema: descriptor.declared_schema,
    sensitivity: descriptor.sensitivity,
    retention: descriptor.retention
  };

  const mismatches = Object.keys(expected).filter((key) => (
    expected[key as keyof typeof expected] !== observed[key as keyof typeof observed]
  ));
  if (mismatches.length > 0) {
    throw new DokionError(
      "ARTIFACT_INVALID",
      "Resolved artifact provenance does not match the canonical Playbook declaration.",
      {
        consumerStep,
        inputName,
        producerStep: producer.step.id,
        outputName: producer.output.name,
        mismatches
      }
    );
  }
}

export async function resolveStepInputs(options: ResolveStepInputsOptions): Promise<ResolvedStepInputs> {
  const step = canonicalStep(options.playbook, options.step.id);
  const declaredInputs = step.inputs ?? [];
  const resolved: ResolvedStepInput[] = [];
  const legacyInputs: string[] = [];
  const missingOptional: string[] = [];

  for (const input of declaredInputs) {
    if (!isTypedInput(input)) {
      legacyInputs.push(input);
      continue;
    }

    const required = input.required ?? true;
    try {
      const producer = canonicalProducer(options.playbook, input.from.step, input.from.output);
      const loaded = await readRunArtifact({
        root: options.root,
        runId: options.runId,
        stepId: input.from.step,
        outputName: input.from.output
      });

      if (loaded.descriptor.kind !== input.kind) {
        throw new DokionError(
          "ARTIFACT_INVALID",
          `Resolved artifact kind ${loaded.descriptor.kind} does not match declared input kind ${input.kind}.`,
          {
            consumerStep: step.id,
            inputName: input.name,
            producerStep: input.from.step,
            producerOutput: input.from.output,
            expectedKind: input.kind,
            observedKind: loaded.descriptor.kind
          }
        );
      }
      assertCanonicalProvenance(loaded.descriptor, producer, step.id, input.name);

      resolved.push({
        name: input.name,
        kind: input.kind,
        required,
        producer: {
          step: input.from.step,
          output: input.from.output
        },
        descriptor: loaded.descriptor,
        blob_path: loaded.descriptor.blob_path
      });
    } catch (error) {
      if (!required && error instanceof DokionError && error.code === "ARTIFACT_NOT_FOUND") {
        missingOptional.push(input.name);
        continue;
      }
      throw error;
    }
  }

  return {
    inputs: resolved,
    legacy_inputs: legacyInputs,
    missing_optional: missingOptional
  };
}