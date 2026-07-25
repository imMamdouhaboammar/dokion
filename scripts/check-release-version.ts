#!/usr/bin/env bun

import packageManifest from "../package.json";
import geminiManifest from "../gemini-extension.json";
import { assertReleaseVersion } from "../src/distribution/distribution-validator.ts";

export function checkReleaseVersion(tag = process.argv[2] ?? process.env.GITHUB_REF_NAME): void {
  if (!tag) throw new Error("A release tag is required as argv[2] or GITHUB_REF_NAME");
  assertReleaseVersion(tag, packageManifest.version, geminiManifest.version);
}

if (import.meta.main) {
  checkReleaseVersion();
  console.log(JSON.stringify({ valid: true, tag: process.argv[2] ?? process.env.GITHUB_REF_NAME }, null, 2));
}
