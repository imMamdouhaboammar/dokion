#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  detectSensitiveText,
  validatePackedFiles,
  validateStaticDistribution
} from "../src/distribution/distribution-validator.ts";

interface NpmPackFile {
  path: string;
  size?: number;
}

interface NpmPackResult {
  filename?: string;
  files?: NpmPackFile[];
}

const textExtensions = new Set([
  ".json",
  ".md",
  ".ts",
  ".toml",
  ".txt",
  ".yml",
  ".yaml"
]);

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index).toLowerCase() : "";
}

async function run(command: string[], cwd: string): Promise<string> {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed (${exitCode})\n${stderr}\n${stdout}`);
  return stdout;
}

export async function validateDistribution(root = process.cwd()): Promise<{
  valid: boolean;
  errors: string[];
  packedFiles: string[];
}> {
  const staticReport = await validateStaticDistribution(root);
  const errors = [...staticReport.errors];
  const npm = Bun.which("npm");
  if (!npm) return { valid: false, errors: [...errors, "npm CLI is required for registry package validation"], packedFiles: [] };

  let results: NpmPackResult[] = [];
  try {
    const output = await run([npm, "pack", "--json", "--dry-run", "--ignore-scripts"], root);
    results = JSON.parse(output) as NpmPackResult[];
  } catch (error) {
    errors.push(`npm pack dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors, packedFiles: [] };
  }

  if (results.length !== 1) errors.push(`npm pack returned ${results.length} package records; expected 1`);
  const files = results[0]?.files ?? [];
  const packedFiles = files.map((file) => file.path.replace(/^package\//, "").replaceAll("\\", "/")).sort();
  errors.push(...validatePackedFiles(packedFiles));

  for (const file of files) {
    const path = file.path.replace(/^package\//, "").replaceAll("\\", "/");
    if (!textExtensions.has(extension(path)) || (file.size ?? 0) > 1_000_000) continue;
    try {
      const content = await readFile(join(root, path), "utf8");
      errors.push(...detectSensitiveText(path, content));
    } catch (error) {
      errors.push(`packed text file is unreadable: ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { valid: errors.length === 0, errors: Array.from(new Set(errors)), packedFiles };
}

if (import.meta.main) {
  const report = await validateDistribution();
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}
