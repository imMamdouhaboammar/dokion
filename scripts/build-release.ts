#!/usr/bin/env bun

import { chmod, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

interface ReleaseTarget {
  target:
    | "bun-linux-x64-baseline"
    | "bun-linux-arm64"
    | "bun-darwin-arm64"
    | "bun-darwin-x64"
    | "bun-windows-x64-baseline";
  filename: string;
  executable: boolean;
}

const targets: ReleaseTarget[] = [
  { target: "bun-linux-x64-baseline", filename: "dokion-linux-x64", executable: true },
  { target: "bun-linux-arm64", filename: "dokion-linux-arm64", executable: true },
  { target: "bun-darwin-arm64", filename: "dokion-darwin-arm64", executable: true },
  { target: "bun-darwin-x64", filename: "dokion-darwin-x64", executable: true },
  { target: "bun-windows-x64-baseline", filename: "dokion-windows-x64.exe", executable: false }
];

export async function buildRelease(root = process.cwd(), outputDirectory = join(root, "release")): Promise<string[]> {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const outputs: string[] = [];

  for (const item of targets) {
    const outfile = join(outputDirectory, item.filename);
    const result = await Bun.build({
      entrypoints: [join(root, "src/cli.ts")],
      compile: item.target,
      minify: true,
      sourcemap: "none",
      outfile
    });
    if (!result.success) {
      const messages = result.logs.map((log) => log.message).join("\n");
      throw new Error(`Bun release build failed for ${item.target}:\n${messages}`);
    }
    if (!(await Bun.file(outfile).exists())) throw new Error(`Bun did not create ${outfile}`);
    if (item.executable) await chmod(outfile, 0o755);
    outputs.push(outfile);
  }

  return outputs;
}

if (import.meta.main) {
  const outputs = await buildRelease();
  console.log(JSON.stringify({ valid: true, outputs }, null, 2));
}
