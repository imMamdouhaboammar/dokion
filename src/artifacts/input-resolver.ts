import { DokionError } from "../core/errors.ts";
import type {
  DokionPlaybook,
  PlaybookArtifactKind,
  PlaybookInputBinding,
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
