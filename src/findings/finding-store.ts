import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { validateFindingData } from "../contracts/schema-validator.ts";
import { sha256File } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import type { RawFindingEnvelope, NormalizedFinding } from "./types.ts";

function laneCode(stageId: string): string {
  const value = stageId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return value || "GEN";
}

function findingsDirectory(root: string): string {
  return join(root, ".dokion", "findings");
}

function findingPath(root: string, id: string): string {
  return join(findingsDirectory(root), `${id}.json`);
}

export async function listFindings(root: string): Promise<NormalizedFinding[]> {
  let entries;
  try {
    entries = await readdir(findingsDirectory(root), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const findings = await Promise.all(
    filenames.map((filename) => readJson<NormalizedFinding>(join(findingsDirectory(root), filename)))
  );
  return findings.sort((left, right) => left.id.localeCompare(right.id));
}

export async function readFinding(root: string, id: string): Promise<NormalizedFinding> {
  return readJson<NormalizedFinding>(findingPath(root, id));
}

export async function writeFinding(root: string, finding: NormalizedFinding): Promise<void> {
  const relativePath = `.dokion/findings/${finding.id}.json`;
  const issues = await validateFindingData(root, finding, relativePath);
  if (issues.length > 0) {
    throw new DokionError("INVALID_STATE", `Finding ${finding.id} failed schema validation`, { issues });
  }
  await writeJsonAtomic(findingPath(root, finding.id), finding);
}

export async function updateFinding(
  root: string,
  id: string,
  mutator: (finding: NormalizedFinding) => NormalizedFinding | Promise<NormalizedFinding>
): Promise<NormalizedFinding> {
  const current = await readFinding(root, id);
  const next = await mutator(structuredClone(current));
  await writeFinding(root, next);
  return next;
}

export async function normalizeFindingEnvelope(input: {
  root: string;
  envelope: RawFindingEnvelope;
  stageId: string;
  stepId: string;
  capabilityId: string;
  capabilityVersion?: string;
  rawArtifact: string;
  runId: string;
}): Promise<NormalizedFinding[]> {
  if (input.envelope.version !== 1 || !Array.isArray(input.envelope.findings)) {
    throw new DokionError("INVALID_STATE", "Capability output is not a DOKION_FINDINGS_V1 envelope", {
      version: input.envelope.version
    });
  }

  const existing = await listFindings(input.root);
  const prefix = `DK-${laneCode(input.stageId)}-`;
  let sequence = existing.filter((finding) => finding.id.startsWith(prefix)).length + 1;
  const rawDigest = await sha256File(join(input.root, input.rawArtifact));
  const capturedAt = new Date().toISOString();
  const normalized: NormalizedFinding[] = [];

  for (const raw of input.envelope.findings) {
    if (!raw || typeof raw.title !== "string" || typeof raw.severity !== "string") {
      throw new DokionError("INVALID_STATE", "Capability emitted an incomplete finding", { raw });
    }

    const id = `${prefix}${String(sequence).padStart(3, "0")}`;
    sequence += 1;
    const finding: NormalizedFinding = {
      id,
      step_id: input.stepId,
      stage_id: input.stageId,
      severity: raw.severity,
      title: raw.title,
      ...(raw.description ? { description: raw.description } : {}),
      source: {
        capability_id: input.capabilityId,
        ...(input.capabilityVersion ? { capability_version: input.capabilityVersion } : {}),
        ...(raw.rule_id ? { rule_id: raw.rule_id } : {}),
        raw_artifact: input.rawArtifact
      },
      ...(raw.location ? { location: raw.location } : {}),
      evidence: [
        {
          kind: "tool_output",
          path: input.rawArtifact,
          digest: rawDigest,
          captured_at: capturedAt,
          phase: "BEFORE"
        }
      ],
      ...(raw.proposed_fix ? { proposed_fix: raw.proposed_fix } : {}),
      status: "OPEN",
      ...(raw.blocks_release !== undefined ? { blocks_release: raw.blocks_release } : {}),
      first_seen_run: input.runId,
      ...(raw.tags ? { tags: raw.tags } : {})
    };
    await writeFinding(input.root, finding);
    normalized.push(finding);
  }

  return normalized;
}
