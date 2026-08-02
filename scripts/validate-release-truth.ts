#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  implementedCliCommands,
  plannedCliCommands,
  renderCliHelp,
  resolveCliCommand
} from "../src/cli/command-registry.ts";
import { writeTextAtomic } from "../src/core/json.ts";
import {
  FORBIDDEN_UNQUALIFIED_PUBLIC_CLAIMS,
  PUBLIC_CLAIM_DOCUMENTS
} from "../src/product/public-claims.ts";
import {
  buildProductSurface,
  serializeProductSurface
} from "../src/product/product-surface.ts";
import type { ProductSurface } from "../src/product/types.ts";
import { DOKION_VERSION } from "../src/runtime/package-metadata.ts";

export const CANONICAL_PACKAGE_DESCRIPTION =
  "Execution control for user-authored engineering Playbooks across coding agents and local tools";

export interface ReleasePackageManifest {
  name?: string;
  version?: string;
  description?: string;
}
export interface ReleaseTruthSources {
  packageManifest: ReleasePackageManifest;
  readme: string;
  cliHelp: string;
  committedProductSurface: string;
  publicDocuments: Record<string, string>;
  commitSha: string | null;
}

export interface ReleaseTruthIssue {
  code: string;
  source: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ReleaseTruthReport {
  schemaVersion: "dokion.release-truth.v1";
  valid: boolean;
  commitSha: string | null;
  package: {
    name: string | null;
    version: string | null;
    description: string | null;
  };
  releaseLine: string | null;
  productSurfaceDigest: string;
  cliHelpDigest: string;
  checkedSources: string[];
  issues: ReleaseTruthIssue[];
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function releaseLine(version: string | undefined): string | null {
  const match = /^(\d+)\.(\d+)\.\d+(?:[-+].*)?$/.exec(version ?? "");
  return match ? `${match[1]}.${match[2]}.x` : null;
}

function addIssue(
  issues: ReleaseTruthIssue[],
  code: string,
  source: string,
  message: string,
  expected?: unknown,
  actual?: unknown
): void {
  issues.push({
    code,
    source,
    message,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {})
  });
}

function parseSurface(
  value: string,
  issues: ReleaseTruthIssue[]
): ProductSurface | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    addIssue(
      issues,
      "PRODUCT_SURFACE_INVALID_JSON",
      "generated/product-surface.json",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }

  const candidate = parsed as Partial<ProductSurface> | null;
  if (
    !candidate
    || candidate.schema_version !== "dokion.product-surface.v1"
    || !Array.isArray(candidate.commands)
    || !Array.isArray(candidate.integrations)
    || !Array.isArray(candidate.packs)
    || !Array.isArray(candidate.registry)
  ) {
    addIssue(
      issues,
      "PRODUCT_SURFACE_INVALID_SHAPE",
      "generated/product-surface.json",
      "Committed product surface is missing the required v1 sections"
    );
    return null;
  }
  return candidate as ProductSurface;
}
function compareCommandSurface(
  committed: ProductSurface | null,
  expected: ProductSurface,
  issues: ReleaseTruthIssue[]
): void {
  if (!committed) return;
  const actualById = new Map(committed.commands.map((entry) => [entry.id, entry] as const));
  const expectedById = new Map(expected.commands.map((entry) => [entry.id, entry] as const));
  const ids = new Set([...actualById.keys(), ...expectedById.keys()]);

  for (const id of [...ids].sort()) {
    const actual = actualById.get(id);
    const wanted = expectedById.get(id);
    if (actual?.status === wanted?.status) continue;
    addIssue(
      issues,
      "COMMAND_SURFACE_DRIFT",
      "generated/product-surface.json",
      `Command ${id} does not match the canonical CLI registry`,
      wanted?.status ?? "ABSENT",
      actual?.status ?? "ABSENT"
    );
  }
}

function validateCliHelp(help: string, issues: ReleaseTruthIssue[]): void {
  const expectedHelp = renderCliHelp(DOKION_VERSION);
  if (help !== `${expectedHelp}\n` && help !== expectedHelp) {
    addIssue(
      issues,
      "CLI_HELP_SNAPSHOT_DRIFT",
      "src/cli.ts --help",
      "Executable CLI help does not match the canonical command registry",
      digest(expectedHelp),
      digest(help)
    );
  }
  const lines = new Set(help.split("\n").map((line) => line.trim()).filter(Boolean));

  for (const command of implementedCliCommands()) {
    if (lines.has(command.helpLine.trim())) continue;
    addIssue(
      issues,
      "CLI_HELP_COMMAND_DRIFT",
      "src/cli/command-registry.ts",
      `Implemented command ${command.id} is missing from CLI help`,
      command.helpLine.trim(),
      "ABSENT"
    );
  }

  for (const command of plannedCliCommands()) {
    if (!lines.has(command.helpLine.trim())) continue;
    addIssue(
      issues,
      "CLI_HELP_COMMAND_DRIFT",
      "src/cli/command-registry.ts",
      `Planned command ${command.id} appears in CLI help`,
      "ABSENT",
      command.helpLine.trim()
    );
  }
}

function validateReadmeCommands(readme: string, issues: ReleaseTruthIssue[]): void {
  const seen = new Set<string>();
  for (const match of readme.matchAll(/\bdokion[ \t]+([a-z][a-z0-9-]*)/g)) {
    const commandName = match[1]!;
    if (seen.has(commandName)) continue;
    seen.add(commandName);
    const descriptor = resolveCliCommand(commandName);
    if (!descriptor) {
      addIssue(
        issues,
        "README_COMMAND_UNKNOWN",
        "README.md",
        `README references unknown command dokion ${commandName}`
      );
      continue;
    }
    if (descriptor.status === "IMPLEMENTED") continue;
    addIssue(
      issues,
      "README_COMMAND_UNAVAILABLE",
      "README.md",
      `README presents planned command dokion ${commandName} as executable`,
      "IMPLEMENTED",
      descriptor.status
    );
  }
}

const INTEGRATION_BADGE_ALIASES: ReadonlyArray<{
  id: string;
  pattern: RegExp;
}> = [
  { id: "claude-code", pattern: /\bclaude(?:[- _]?code)?\b/i },
  { id: "codex", pattern: /\bcodex\b/i },
  { id: "gemini-cli", pattern: /\bgemini(?:[- _]?cli)?\b/i },
  { id: "cursor", pattern: /\bcursor\b/i },
  { id: "agy", pattern: /\bagy\b/i },
  { id: "windsurf", pattern: /\bwindsurf\b/i }
];
function validateIntegrationBadges(
  readme: string,
  surface: ProductSurface,
  issues: ReleaseTruthIssue[]
): void {
  const integrations = new Map(surface.integrations.map((entry) => [entry.id, entry] as const));
  for (const match of readme.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const badge = `${match[1]} ${match[2]}`;
    for (const alias of INTEGRATION_BADGE_ALIASES) {
      if (!alias.pattern.test(badge)) continue;
      const integration = integrations.get(alias.id);
      if (integration?.status === "IMPLEMENTED") continue;
      addIssue(
        issues,
        "UNSUPPORTED_INTEGRATION_BADGE",
        "README.md",
        `README badge presents unsupported integration ${alias.id}`,
        "IMPLEMENTED",
        integration?.status ?? "ABSENT"
      );
    }
  }
}

function validatePublicClaims(
  sources: ReleaseTruthSources,
  surface: ProductSurface,
  issues: ReleaseTruthIssue[]
): void {
  for (const document of PUBLIC_CLAIM_DOCUMENTS) {
    const text = sources.publicDocuments[document.path];
    if (text === undefined) {
      addIssue(issues, "PUBLIC_CLAIM_DOCUMENT_MISSING", document.path, "Public claim document is missing");
      continue;
    }

    for (const claim of document.claims) {
      if (!text.includes(claim.requiredMarker)) {
        addIssue(
          issues,
          "PUBLIC_CLAIM_EVIDENCE_MISSING",
          document.path,
          `Claim ${claim.id} is missing its required evidence marker`,
          claim.requiredMarker,
          "ABSENT"
        );
      }
      if (!claim.productSurfaceId || !claim.productSurfaceSection) continue;
      const entry = surface[claim.productSurfaceSection].find(
        (candidate) => candidate.id === claim.productSurfaceId
      );
      if (entry?.status === claim.status) continue;
      addIssue(
        issues,
        "PUBLIC_CLAIM_STATUS_DRIFT",
        document.path,
        `Claim ${claim.id} status does not match the product surface`,
        entry?.status ?? "ABSENT",
        claim.status
      );
    }

    for (const forbidden of FORBIDDEN_UNQUALIFIED_PUBLIC_CLAIMS) {
      if (!forbidden.test(text)) continue;
      addIssue(
        issues,
        "FORBIDDEN_PUBLIC_CLAIM",
        document.path,
        `Document contains unsupported unqualified wording: ${forbidden.source}`
      );
    }
  }
}

function sortedIssues(issues: ReleaseTruthIssue[]): ReleaseTruthIssue[] {
  return issues.sort((left, right) =>
    left.source.localeCompare(right.source)
      || left.code.localeCompare(right.code)
      || left.message.localeCompare(right.message)
  );
}

export function evaluateReleaseTruth(sources: ReleaseTruthSources): ReleaseTruthReport {
  const issues: ReleaseTruthIssue[] = [];
  const expectedSurface = buildProductSurface();
  const expectedSurfaceText = serializeProductSurface(expectedSurface);
  const committedSurface = parseSurface(sources.committedProductSurface, issues);
  validateCliHelp(sources.cliHelp, issues);
  const expectedReleaseLine = releaseLine(sources.packageManifest.version);

  if (!sources.commitSha || !/^[a-f0-9]{40}$/i.test(sources.commitSha)) {
    addIssue(
      issues,
      "RELEASE_COMMIT_UNAVAILABLE",
      "git:HEAD",
      "Release truth cannot identify the exact release-candidate commit"
    );
  }

  if (sources.packageManifest.name !== "dokion") {
    addIssue(
      issues,
      "PACKAGE_NAME_DRIFT",
      "package.json",
      "Release package name must remain dokion",
      "dokion",
      sources.packageManifest.name ?? null
    );
  }

  if (sources.packageManifest.version !== DOKION_VERSION) {
    addIssue(
      issues,
      "PACKAGE_VERSION_DRIFT",
      "package.json",
      "Package version does not match runtime metadata",
      DOKION_VERSION,
      sources.packageManifest.version ?? null
    );
  }

  if (sources.packageManifest.description !== CANONICAL_PACKAGE_DESCRIPTION) {
    addIssue(
      issues,
      "PACKAGE_DESCRIPTION_DRIFT",
      "package.json",
      "Package description does not match the approved product position",
      CANONICAL_PACKAGE_DESCRIPTION,
      sources.packageManifest.description ?? null
    );
  }

  if (!expectedReleaseLine) {
    addIssue(
      issues,
      "PACKAGE_VERSION_INVALID",
      "package.json",
      "Package version is not a supported semantic version",
      "major.minor.patch",
      sources.packageManifest.version ?? null
    );
  } else {
    const lineMarker = `Current release line: \`${expectedReleaseLine}\``;
    const badgeMarker = `release-${expectedReleaseLine}`;
    if (!sources.readme.includes(lineMarker) || !sources.readme.includes(badgeMarker)) {
      addIssue(
        issues,
        "RELEASE_LINE_DRIFT",
        "README.md",
        "README release line does not match package.json",
        { lineMarker, badgeMarker },
        expectedReleaseLine
      );
    }
  }

  if (sources.committedProductSurface !== expectedSurfaceText) {
    addIssue(
      issues,
      "GENERATED_PRODUCT_SURFACE_DRIFT",
      "generated/product-surface.json",
      "Committed product surface does not match deterministic generation",
      digest(expectedSurfaceText),
      digest(sources.committedProductSurface)
    );
  }

  compareCommandSurface(committedSurface, expectedSurface, issues);
  validateReadmeCommands(sources.readme, issues);
  validateIntegrationBadges(sources.readme, expectedSurface, issues);
  validatePublicClaims(sources, expectedSurface, issues);

  const checkedSources = [
    "package.json",
    "README.md",
    "generated/product-surface.json",
    "src/cli/command-registry.ts",
    ...PUBLIC_CLAIM_DOCUMENTS.map((document) => document.path)
  ].filter((value, index, values) => values.indexOf(value) === index).sort();

  const orderedIssues = sortedIssues(issues);
  return {
    schemaVersion: "dokion.release-truth.v1",
    valid: orderedIssues.length === 0,
    commitSha: sources.commitSha,
    package: {
      name: sources.packageManifest.name ?? null,
      version: sources.packageManifest.version ?? null,
      description: sources.packageManifest.description ?? null
    },
    releaseLine: expectedReleaseLine,
    productSurfaceDigest: digest(expectedSurfaceText),
    cliHelpDigest: digest(sources.cliHelp),
    checkedSources,
    issues: orderedIssues
  };
}
async function runTextCommand(root: string, command: string[]): Promise<string | null> {
  const child = Bun.spawn(command, {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : ""
  ]);
  return exitCode === 0 ? stdout : null;
}

async function currentCommit(root: string): Promise<string | null> {
  const output = await runTextCommand(root, ["git", "rev-parse", "HEAD"]);
  const value = output?.trim() ?? "";
  return /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : null;
}

async function executableCliHelp(root: string): Promise<string> {
  const output = await runTextCommand(root, [process.execPath, "src/cli.ts", "--help"]);
  if (output === null) {
    throw new Error("Executable CLI help could not be generated from src/cli.ts --help");
  }
  return output;
}

export async function loadReleaseTruthSources(root: string): Promise<ReleaseTruthSources> {
  const packageManifest = await Bun.file(join(root, "package.json")).json() as ReleasePackageManifest;
  const readme = await Bun.file(join(root, "README.md")).text();
  const committedProductSurface = await Bun.file(
    join(root, "generated", "product-surface.json")
  ).text();
  const publicDocuments: Record<string, string> = {};

  for (const document of PUBLIC_CLAIM_DOCUMENTS) {
    publicDocuments[document.path] = await Bun.file(join(root, document.path)).text();
  }

  return {
    packageManifest,
    readme,
    cliHelp: await executableCliHelp(root),
    committedProductSurface,
    publicDocuments,
    commitSha: await currentCommit(root)
  };
}
export async function validateReleaseTruth(root = process.cwd()): Promise<ReleaseTruthReport> {
  return evaluateReleaseTruth(await loadReleaseTruthSources(root));
}

function outputPath(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--output");
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--output requires a file path");
  }
  return value;
}

export async function writeReleaseTruthReport(
  root: string,
  path: string,
  report: ReleaseTruthReport
): Promise<void> {
  const repositoryRoot = resolve(root);
  const absolutePath = resolve(repositoryRoot, path);
  const repositoryPath = relative(repositoryRoot, absolutePath);
  if (!repositoryPath || repositoryPath === ".." || repositoryPath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(repositoryPath)) {
    throw new Error("Release truth report output must remain inside the repository root");
  }
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeTextAtomic(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "json");
}

if (import.meta.main) {
  const root = process.cwd();
  const report = await validateReleaseTruth(root);
  const requestedOutput = outputPath(process.argv.slice(2));
  if (requestedOutput) {
    await writeReleaseTruthReport(root, requestedOutput, report);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}
