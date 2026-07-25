import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageManifest {
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

export interface ProjectProfile {
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  has_frontend: boolean;
  has_api: boolean;
  has_database: boolean;
  has_llm: boolean;
  has_infrastructure: boolean;
  is_monorepo: boolean;
  test_command?: string;
  build_command?: string;
  detected_at: string;
}

async function exists(root: string, path: string): Promise<boolean> {
  return Bun.file(join(root, path)).exists();
}

async function hasMatch(root: string, pattern: string): Promise<boolean> {
  const glob = new Bun.Glob(pattern);
  for await (const _path of glob.scan({ cwd: root, onlyFiles: true })) {
    return true;
  }
  return false;
}

export async function inspectProject(root: string): Promise<ProjectProfile> {
  let packageManifest: PackageManifest | undefined;
  if (await exists(root, "package.json")) {
    packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as PackageManifest;
  }

  const dependencies = new Set([
    ...Object.keys(packageManifest?.dependencies ?? {}),
    ...Object.keys(packageManifest?.devDependencies ?? {})
  ]);

  const languages: string[] = [];
  if ((await exists(root, "tsconfig.json")) || (await hasMatch(root, "**/*.ts"))) languages.push("TypeScript");
  if ((await exists(root, "package.json")) || (await hasMatch(root, "**/*.js"))) languages.push("JavaScript");
  if ((await exists(root, "pyproject.toml")) || (await exists(root, "requirements.txt")) || (await hasMatch(root, "**/*.py"))) languages.push("Python");
  if (await exists(root, "Cargo.toml")) languages.push("Rust");
  if (await exists(root, "go.mod")) languages.push("Go");
  if (await exists(root, "Package.swift")) languages.push("Swift");

  const frameworkRules: Array<[string, string[]]> = [
    ["React", ["react"]],
    ["Next.js", ["next"]],
    ["Vue", ["vue"]],
    ["Nuxt", ["nuxt"]],
    ["Svelte", ["svelte", "@sveltejs/kit"]],
    ["Angular", ["@angular/core"]],
    ["Express", ["express"]],
    ["Fastify", ["fastify"]],
    ["Hono", ["hono"]],
    ["NestJS", ["@nestjs/core"]],
    ["Prisma", ["prisma", "@prisma/client"]],
    ["Drizzle", ["drizzle-orm"]]
  ];
  const frameworks = frameworkRules
    .filter(([, packages]) => packages.some((name) => dependencies.has(name)))
    .map(([name]) => name);

  const packageManagers: string[] = [];
  if ((await exists(root, "bun.lock")) || (await exists(root, "bun.lockb")) || packageManifest?.packageManager?.startsWith("bun@")) packageManagers.push("bun");
  if (await exists(root, "pnpm-lock.yaml")) packageManagers.push("pnpm");
  if (await exists(root, "yarn.lock")) packageManagers.push("yarn");
  if (await exists(root, "package-lock.json")) packageManagers.push("npm");
  if (await exists(root, "uv.lock")) packageManagers.push("uv");

  const frontendPackages = ["react", "next", "vue", "nuxt", "svelte", "@sveltejs/kit", "@angular/core"];
  const apiPackages = ["express", "fastify", "hono", "@nestjs/core", "koa"];
  const databasePackages = ["prisma", "@prisma/client", "drizzle-orm", "typeorm", "sequelize", "mongoose", "pg", "mysql2"];
  const llmPackages = ["openai", "@anthropic-ai/sdk", "ai", "@google/generative-ai", "@google/genai"];

  return {
    languages,
    frameworks,
    package_managers: packageManagers,
    has_frontend: frontendPackages.some((name) => dependencies.has(name)) || await hasMatch(root, "**/*.{tsx,jsx,vue,svelte}"),
    has_api: apiPackages.some((name) => dependencies.has(name)) || await hasMatch(root, "**/{routes,api}/**/*"),
    has_database: databasePackages.some((name) => dependencies.has(name)) || await exists(root, "prisma/schema.prisma") || await hasMatch(root, "**/migrations/**/*"),
    has_llm: llmPackages.some((name) => dependencies.has(name)),
    has_infrastructure: await exists(root, "Dockerfile") || await hasMatch(root, "**/*.{tf,yaml,yml}") || await exists(root, "vercel.json"),
    is_monorepo: Boolean(packageManifest?.workspaces) || dependencies.has("turbo") || dependencies.has("nx") || await exists(root, "pnpm-workspace.yaml"),
    ...(packageManifest?.scripts?.test ? { test_command: "bun test" } : {}),
    ...(packageManifest?.scripts?.build ? { build_command: "bun run build" } : {}),
    detected_at: new Date().toISOString()
  };
}
