import { createHash } from "node:crypto";
import { validatePlaybookData } from "../contracts/schema-validator.ts";
import type { DokionPlaybook, PlaybookStep } from "../playbook/types.js";
import type { ExtractedActionStep } from "./types.js";

export class PlaybookCompiler {
  public async compile(
    steps: ExtractedActionStep[],
    options?: { topic?: string; title?: string; description?: string }
  ): Promise<DokionPlaybook> {
    const topicName = options?.topic ?? "Custom Workflow";
    const title = options?.title ?? (
      options?.topic ? `${options.topic} Playbook` : "Generated Engineering Playbook"
    );
    const description = options?.description
      ?? `Synthesized Playbook by Dokion Creator Engine for topic: ${topicName}`;

    const compiledSteps: PlaybookStep[] = steps.map((step, index) => {
      const stepPayload = JSON.stringify({
        id: step.id,
        title: step.title,
        command: step.command,
        verificationCommands: step.verificationCommands,
      });
      const sha256 = createHash("sha256").update(stepPayload).digest("hex");
      const previousStep = index > 0 ? steps[index - 1] : undefined;
      const verification = step.verificationCommands?.length
        ? step.verificationCommands
        : ["git status --short"];

      return {
        id: step.id,
        name: step.title,
        capability: {
          type: "tool",
          id: "run_command",
          source: "dokion.json",
          immutable_reference: `sha256:${sha256}`,
        },
        responsibility: step.description,
        mode: "FIX_WITH_APPROVAL",
        required: true,
        approval: "BEFORE_WRITE",
        failure_policy: "STOP_STAGE",
        verification,
        ...(previousStep !== undefined ? { depends_on: [previousStep.id] } : {}),
        permissions: {
          read: ["**/*"],
          write: [".dokion/**"],
          network: false,
          ...(step.command !== undefined ? { shell: [step.command] } : {}),
        },
      };
    });

    const playbook: DokionPlaybook = {
      $schema: "../schemas/dokion-playbook.schema.json",
      version: "1.0.0",
      project: {
        name: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        target: "BASELINE",
        notes: description,
      },
      authority: {
        capability_selection: "USER_ONLY",
        execution_order: "USER_ONLY",
        capability_behavior: "USER_ONLY",
        automatic_capability_discovery: false,
        automatic_installation: false,
        automatic_substitution: false,
        automatic_reordering: false,
        allow_recommendations: true,
        recommendations_require_approval: true,
      },
      enforcement: {
        playbook_immutable: true,
        hash_algorithm: "sha256",
        verify_before_each_step: true,
        on_mutation: "ABORT_TAINTED",
        protected_paths: [".dokion/playbook.json"],
        worktree_policy: "clean-only",
      },
      registry: {
        sources: ["dokion.json"],
        require_verified: false,
        require_digest: false,
        on_unverified: "STOP_STEP",
      },
      defaults: {
        approval: "BEFORE_WRITE",
        failure_policy: "STOP_STAGE",
        retry_count: 1,
        maximum_iterations: 1,
        parallel_execution: false,
      },
      stages: [
        {
          id: "stage-1-generated-workflow",
          name: `${topicName} Stage`,
          execution: "SEQUENTIAL",
          steps: compiledSteps,
        },
      ],
    };

    const issues = await validatePlaybookData(
      process.cwd(),
      playbook,
      ".dokion/playbook.json"
    );
    if (issues.length > 0) {
      throw new Error(
        `Generated Playbook failed schema contract validation: ${JSON.stringify(issues)}`
      );
    }

    return playbook;
  }
}
