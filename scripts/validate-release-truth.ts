#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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
import { parseCliInvocation } from "../src/cli/parser.ts";
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
  worktreeClean: boolean | null;
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
  worktreeClean: boolean | null;
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

function commandExamples(readme: string): string[] {
  const examples = new Set<string>();
  for (const match of readme.matchAll(/`(dokion(?:[ \t]+[^`\n]+)?)`/g)) {
    examples.add(match[1]!.trim());
  }
  for (const line of readme.split("\n")) {
    const command = line.trim();
    if (/^dokion(?:\s|$)/.test(command)) examples.add(command);
  }
  return [...examples].sort();
}

function commandTokens(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (escaped || quote) throw new Error("unterminated shell token");
  if (current) tokens.push(current);
  return tokens;
}

function validateReadmeCommands(readme: string, issues: ReleaseTruthIssue[]): void {
  for (const example of commandExamples(readme)) {
    let tokens: string[];
    try {
      tokens = commandTokens(example);
    } catch (error) {
      addIssue(
        issues,
        "README_COMMAND_INVALID",
        "README.md",
        `README command example cannot be parsed: ${example}`,
        "valid Dokion CLI syntax",
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }
    if (tokens[0] !== "dokion" || tokens.length < 2) continue;
    const commandName = tokens[1]!;
    if (["help", "--help", "-h"].includes(commandName)) continue;
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
    if (descriptor.status !== "IMPLEMENTED") {
      addIssue(
        issues,
        "README_COMMAND_UNAVAILABLE",
        "README.md",
        `README presents planned command dokion ${commandName} as executable`,
        "IMPLEMENTED",
        descriptor.status
      );
      continue;
    }
    if (tokens.length === 2) continue;
    try {
      parseCliInvocation(tokens.slice(1));
    } catch (error) {
      addIssue(
        issues,
        "README_COMMAND_INVALID",
        "README.md",
        `README presents an invalid executable command: ${example}`,
        descriptor.manifestUsage ?? descriptor.manifestCommand,
        error instanceof Error ? error.message : String(error)
      );
    }
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
  if (sources.worktreeClean === false) {
    addIssue(
      issues,
      "RELEASE_WORKTREE_DIRTY",
      "git:worktree",
      "Tracked working-tree or index changes do not match the commit bound to this report",
      "clean tracked worktree",
      "DIRTY"
    );
  } else if (sources.worktreeClean === null) {
    addIssue(
      issues,
      "RELEASE_WORKTREE_STATUS_UNAVAILABLE",
      "git:worktree",
      "Release truth cannot verify that checked sources match the bound commit"
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
    worktreeClean: sources.worktreeClean,
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
export interface TextCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runTextCommand(
  root: string,
  command: string[],
  timeoutMs = 10_000
): Promise<TextCommandResult> {
  const child = Bun.spawn(command, {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    timeout: timeoutMs
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  return { exitCode, stdout, stderr };
}

async function currentCommit(root: string): Promise<string | null> {
  const result = await runTextCommand(root, ["git", "rev-parse", "HEAD"]);
  const value = result.exitCode === 0 ? result.stdout.trim() : "";
  return /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : null;
}

async function currentWorktreeClean(root: string): Promise<boolean | null> {
  const result = await runTextCommand(
    root,
    ["git", "status", "--porcelain=v1", "--untracked-files=no"]
  );
  if (result.exitCode !== 0) return null;
  return result.stdout.trim().length === 0;
}

async function executableCliHelp(root: string): Promise<string> {
  const result = await runTextCommand(root, [process.execPath, "src/cli.ts", "--help"]);
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || `exit code ${result.exitCode}`;
    throw new Error(`Executable CLI help could not be generated from src/cli.ts --help: ${detail}`);
  }
  return result.stdout;
}

export async function loadPublicClaimDocuments(root: string): Promise<Record<string, string>> {
  const publicDocuments: Record<string, string> = {};
  for (const document of PUBLIC_CLAIM_DOCUMENTS) {
    const file = Bun.file(join(root, document.path));
    if (await file.exists()) publicDocuments[document.path] = await file.text();
  }
  return publicDocuments;
}

export async function loadReleaseTruthSources(root: string): Promise<ReleaseTruthSources> {
  const packageManifest = await Bun.file(join(root, "package.json")).json() as ReleasePackageManifest;
  const readme = await Bun.file(join(root, "README.md")).text();
  const committedProductSurface = await Bun.file(
    join(root, "generated", "product-surface.json")
  ).text();
  const [cliHelp, publicDocuments, commitSha, worktreeClean] = await Promise.all([
    executableCliHelp(root),
    loadPublicClaimDocuments(root),
    currentCommit(root),
    currentWorktreeClean(root)
  ]);

  return {
    packageManifest,
    readme,
    cliHelp,
    committedProductSurface,
    publicDocuments,
    commitSha,
    worktreeClean
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

function insideRoot(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function metadata(path: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function safeReportPath(root: string, requested: string): Promise<string> {
  if (!requested || isAbsolute(requested) || requested.includes("\u0000")) {
    throw new Error("Release truth report output must be a relative path inside the repository root");
  }

  const repositoryRoot = await realpath(resolve(root));
  const absolutePath = resolve(repositoryRoot, requested);
  if (!insideRoot(repositoryRoot, absolutePath) || absolutePath === repositoryRoot) {
    throw new Error("Release truth report output must remain inside the repository root");
  }

  const parentPath = dirname(absolutePath);
  const relativeParent = relative(repositoryRoot, parentPath);
  let current = repositoryRoot;
  for (const segment of relativeParent === "" ? [] : relativeParent.split(sep)) {
    current = join(current, segment);
    let currentMetadata = await metadata(current);
    if (!currentMetadata) {
      await mkdir(current, { mode: 0o700 });
      currentMetadata = await metadata(current);
    }
    if (!currentMetadata || currentMetadata.isSymbolicLink() || !currentMetadata.isDirectory()) {
      throw new Error("Release truth report output path may contain only real directories");
    }
    const canonical = await realpath(current);
    if (!insideRoot(repositoryRoot, canonical)) {
      throw new Error("Release truth report output path may not escape through symbolic links");
    }
  }

  const existing = await metadata(absolutePath);
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) {
    throw new Error("Release truth report output must be a regular file path without symbolic links");
  }
  return absolutePath;
}

export async function writeReleaseTruthReport(
  root: string,
  path: string,
  report: ReleaseTruthReport
): Promise<void> {
  const absolutePath = await safeReportPath(root, path);
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
