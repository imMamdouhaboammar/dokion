#!/usr/bin/env bun

import {
  detectSensitiveText,
  validatePackedFiles,
  validateStaticDistribution
} from "../src/distribution/distribution-validator.ts";
import {
  createPackedArchive,
  readPackedText,
  removePackedArchive
} from "../src/distribution/package-archive.ts";

const textExtensions = new Set([".json", ".md", ".ts", ".toml", ".txt", ".yml", ".yaml"]);

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index).toLowerCase() : "";
}

export async function validateDistribution(root = process.cwd()): Promise<{
  valid: boolean;
  errors: string[];
  packedFiles: string[];
}> {
  const staticReport = await validateStaticDistribution(root);
  const errors = [...staticReport.errors];
  let archive;

  try {
    archive = await createPackedArchive(root);
    errors.push(...validatePackedFiles(archive.files));

    for (const path of archive.files) {
      if (!textExtensions.has(extension(path))) continue;
      const file = Bun.file(`${archive.extractedRoot}/${path}`);
      if (file.size > 1_000_000) continue;
      try {
        errors.push(...detectSensitiveText(path, await readPackedText(archive, path)));
      } catch (error) {
        errors.push(`packed text file is unreadable: ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: Array.from(new Set(errors)),
      packedFiles: archive.files
    };
  } catch (error) {
    errors.push(`Bun package validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors: Array.from(new Set(errors)), packedFiles: [] };
  } finally {
    if (archive) await removePackedArchive(archive);
  }
}

if (import.meta.main) {
  const report = await validateDistribution();
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}
