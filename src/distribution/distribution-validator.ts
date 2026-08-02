import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DistributionValidationReport {
  valid: boolean;
  errors: string[];
  packageVersion?: string;
  geminiVersion?: string;
  canonicalSkill: string;
}

interface PackageManifest {
  name?: string;
  version?: string;
  description?: string;
  repository?: string | { type?: string; url?: string };
  homepage?: string;
  bugs?: string | { url?: string };
  author?: string | { name?: string };
  keywords?: string[];
  files?: string[];
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  publishConfig?: { access?: string; registry?: string };
  scripts?: Record<string, string>;
}

interface GeminiManifest {
  name?: string;
  version?: string;
  contextFileName?: string;
  plan?: { directory?: string };
}

const CANONICAL_SKILL = "skills/dokion-hardening/SKILL.md";

const requiredPackedPaths = [
  "package.json",
  "README.md",
  "LICENSE",
  "src/cli.ts",
  "schemas/dokion-playbook.schema.json",
  CANONICAL_SKILL,
  ".claude-plugin/plugin.json",
  "hooks/hooks.json",
  "scripts/claude-playbook-guard.ts",
  "scripts/validate-release-truth.ts",
  "generated/product-surface.json",
  "docs/getting-started/ONBOARDING.md",
  "docs/launch/MARKETING_STRATEGY.md",
  "docs/launch/public-beta-checklist.md",
  "AGENTS.md",
  ".agents/skills/dokion-hardening/SKILL.md",
  "GEMINI.md",
  "gemini-extension.json",
  "commands/dokion/run.toml",
  "commands/dokion/status.toml",
  "dokion.json"
] as const;

const requiredPackageFiles = [
  "src",
  "schemas",
  "skills",
  "playbooks/reference",
  "templates",
  "commands",
  "hooks",
  "scripts/claude-playbook-guard.ts",
  "scripts/validate-release-truth.ts",
  "generated/product-surface.json",
  "docs/getting-started/ONBOARDING.md",
  "docs/launch/MARKETING_STRATEGY.md",
  "docs/launch/public-beta-checklist.md",
  "dokion.json",
  "SPEC.md",
  "AGENTS.md",
  "GEMINI.md",
  "gemini-extension.json",
  ".claude-plugin",
  ".claude/skills/dokion",
  ".codex/AGENTS.md",
  ".agents/skills/dokion-hardening"
] as const;

const forbiddenPackedPatterns: RegExp[] = [
  /^tests\//,
  /^\.dokion(?:\/|$)/,
  /^docs\/superpowers\//,
  /^\.github\//,
  /^diagnostics\//,
  /^dist\//,
  /^(?:\.env(?:\..*)?|\.npmrc)$/,
  /^(?:bun\.lock|bun\.lockb|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  /^(?:tsconfig\.json|CLAUDE\.md)$/
];

const secretPatterns: Array<[string, RegExp]> = [
  ["OpenAI-style key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/],
  ["GitHub token", /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{16,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["credentialed database URL", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/i],
  ["provider secret assignment", /\b(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|AWS|SUPABASE|DATABASE)_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s"']+/]
];

const privatePathPatterns: RegExp[] = [
  /(?:^|[\s"'])\/Users\/[A-Za-z0-9._-]+\//,
  /(?:^|[\s"'])\/home\/[A-Za-z0-9._-]+\//,
  /(?:^|[\s"'])[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/
];

async function readJson<T>(root: string, path: string): Promise<T> {
  return JSON.parse(await readFile(join(root, path), "utf8")) as T;
}

async function readText(root: string, path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

function repositoryUrl(value: PackageManifest["repository"]): string | undefined {
  return typeof value === "string" ? value : value?.url;
}

function bugsUrl(value: PackageManifest["bugs"]): string | undefined {
  return typeof value === "string" ? value : value?.url;
}

function authorName(value: PackageManifest["author"]): string | undefined {
  return typeof value === "string" ? value : value?.name;
}

function requireEqual(errors: string[], label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) errors.push(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function requireIncludes(errors: string[], label: string, values: string[] | undefined, expected: string): void {
  if (!values?.includes(expected)) errors.push(`${label} is missing ${expected}`);
}

export function assertReleaseVersion(tag: string, packageVersion: string, geminiVersion: string): void {
  if (!tag.startsWith("v")) throw new Error(`Release tag must start with v: ${tag}`);
  if (tag.slice(1) !== packageVersion) throw new Error(`Release tag ${tag} does not match package version ${packageVersion}`);
  if (geminiVersion !== packageVersion) {
    throw new Error(`Gemini extension version ${geminiVersion} does not match package version ${packageVersion}`);
  }
}

export function validatePackedFiles(paths: string[]): string[] {
  const normalized = Array.from(new Set(paths.map((path) => path.replace(/^package\//, "").replaceAll("\\", "/")))).sort();
  const errors: string[] = [];
  for (const required of requiredPackedPaths) {
    if (!normalized.includes(required)) errors.push(`required packed path missing: ${required}`);
  }
  for (const path of normalized) {
    if (forbiddenPackedPatterns.some((pattern) => pattern.test(path))) errors.push(`forbidden packed path: ${path}`);
  }
  return errors;
}

export function detectSensitiveText(path: string, content: string): string[] {
  const errors: string[] = [];
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) errors.push(`secret signature (${label}) in ${path}`);
  }
  if (privatePathPatterns.some((pattern) => pattern.test(content))) errors.push(`private local path in ${path}`);
  return errors;
}

export async function validateStaticDistribution(root: string): Promise<DistributionValidationReport> {
  const errors: string[] = [];
  let packageManifest: PackageManifest = {};
  let geminiManifest: GeminiManifest = {};

  try {
    packageManifest = await readJson<PackageManifest>(root, "package.json");
  } catch (error) {
    errors.push(`package.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    geminiManifest = await readJson<GeminiManifest>(root, "gemini-extension.json");
  } catch (error) {
    errors.push(`gemini-extension.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  requireEqual(errors, "package name", packageManifest.name, "dokion");
  requireEqual(errors, "package bin", packageManifest.bin?.dokion, "./src/cli.ts");
  requireEqual(errors, "package repository", repositoryUrl(packageManifest.repository), "git+https://github.com/imMamdouhaboammar/dokion.git");
  requireEqual(errors, "package homepage", packageManifest.homepage, "https://github.com/imMamdouhaboammar/dokion#readme");
  requireEqual(errors, "package bugs", bugsUrl(packageManifest.bugs), "https://github.com/imMamdouhaboammar/dokion/issues");
  requireEqual(errors, "package author", authorName(packageManifest.author), "Mamdouh Aboammar");
  requireEqual(errors, "publish access", packageManifest.publishConfig?.access, "public");
  requireEqual(errors, "publish registry", packageManifest.publishConfig?.registry, "https://registry.npmjs.org/");
  requireEqual(errors, "Gemini extension name", geminiManifest.name, "dokion");
  requireEqual(errors, "Gemini context file", geminiManifest.contextFileName, "GEMINI.md");
  requireEqual(errors, "Gemini plan directory", geminiManifest.plan?.directory, ".dokion/plans");

  for (const keyword of ["software-hardening", "agent", "claude-code", "codex", "gemini-cli", "security"]) {
    requireIncludes(errors, "package keywords", packageManifest.keywords, keyword);
  }
  for (const path of requiredPackageFiles) requireIncludes(errors, "package files", packageManifest.files, path);

  if (!packageManifest.scripts?.["validate:distribution"]?.includes("scripts/validate-distribution.ts")) {
    errors.push("validate:distribution script is missing");
  }
  if (!packageManifest.scripts?.["smoke:package"]?.includes("scripts/smoke-test-package.ts")) {
    errors.push("smoke:package script is missing");
  }
  if (!packageManifest.scripts?.["validate:release-truth"]?.includes("scripts/validate-release-truth.ts")) {
    errors.push("validate:release-truth script is missing");
  }
  if (!packageManifest.scripts?.prepack?.includes("validate:release-truth")) {
    errors.push("prepack must run release truth validation");
  }
  if (!packageManifest.scripts?.prepack?.includes("validate:distribution")) errors.push("prepack must run distribution validation");

  const packageVersion = packageManifest.version;
  const geminiVersion = geminiManifest.version;
  if (!packageVersion) errors.push("package version is missing");
  if (!geminiVersion) errors.push("Gemini extension version is missing");
  if (packageVersion && geminiVersion && packageVersion !== geminiVersion) {
    errors.push(`version mismatch: package=${packageVersion}, gemini=${geminiVersion}`);
  }

  const textFiles = [
    CANONICAL_SKILL,
    ".agents/skills/dokion-hardening/SKILL.md",
    ".claude/skills/dokion/SKILL.md",
    "AGENTS.md",
    "GEMINI.md",
    "commands/dokion/run.toml",
    "commands/dokion/status.toml",
    "scripts/claude-playbook-guard.ts"
  ];
  const contents = new Map<string, string>();
  for (const path of textFiles) {
    try {
      const content = await readText(root, path);
      contents.set(path, content);
      errors.push(...detectSensitiveText(path, content));
    } catch (error) {
      errors.push(`required distribution file is unreadable: ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const wrapper of [".agents/skills/dokion-hardening/SKILL.md", ".claude/skills/dokion/SKILL.md"]) {
    if (!contents.get(wrapper)?.includes(`CANONICAL_SKILL: ${CANONICAL_SKILL}`)) errors.push(`${wrapper} does not resolve the canonical skill`);
  }
  if (!contents.get(CANONICAL_SKILL)?.includes("Never select, install, substitute, reorder, or enable a capability")) {
    errors.push("canonical skill authority invariant is missing");
  }

  try {
    const plugin = await readJson<{ name?: string; version?: string }>(root, ".claude-plugin/plugin.json");
    requireEqual(errors, "Claude plugin name", plugin.name, "dokion");
    if (plugin.version !== undefined) errors.push("Claude plugin version must remain omitted so Git SHA updates are authoritative");
  } catch (error) {
    errors.push(`Claude plugin manifest is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const hooks = await readJson<{ hooks?: { PreToolUse?: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }> } }>(root, "hooks/hooks.json");
    const preTool = hooks.hooks?.PreToolUse?.[0];
    if (!preTool?.matcher?.includes("Write") || !preTool.matcher.includes("Bash")) errors.push("Claude PreToolUse matcher is incomplete");
    if (!preTool?.hooks?.[0]?.command?.includes("claude-playbook-guard.ts")) errors.push("Claude playbook guard command is missing");
  } catch (error) {
    errors.push(`Claude hooks manifest is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const commandPath of ["commands/dokion/run.toml", "commands/dokion/status.toml"]) {
    try {
      const parsed = Bun.TOML.parse(await readText(root, commandPath)) as { description?: string; prompt?: string };
      if (!parsed.description || !parsed.prompt) errors.push(`${commandPath} must contain description and prompt`);
    } catch (error) {
      errors.push(`${commandPath} is invalid TOML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    ...(packageVersion ? { packageVersion } : {}),
    ...(geminiVersion ? { geminiVersion } : {}),
    canonicalSkill: CANONICAL_SKILL
  };
}
