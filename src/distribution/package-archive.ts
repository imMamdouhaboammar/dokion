import { lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export interface PackedArchive {
  workspace: string;
  archivePath: string;
  extractedRoot: string;
  files: string[];
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

async function onlyTarball(directory: string): Promise<string> {
  const entries = (await readdir(directory)).filter((name) => name.endsWith(".tgz"));
  if (entries.length !== 1) throw new Error(`Expected one Bun package tarball, found ${entries.length}`);
  return join(directory, entries[0]!);
}

async function listRegularFiles(root: string): Promise<string[]> {
  const paths: string[] = [];
  const glob = new Bun.Glob("**/*");
  for await (const path of glob.scan({ cwd: root, onlyFiles: false, dot: true })) {
    const stat = await lstat(join(root, path));
    if (stat.isSymbolicLink()) throw new Error(`Packed archive contains a symlink: ${path}`);
    if (stat.isFile()) paths.push(path.replaceAll("\\", "/"));
  }
  return paths.sort();
}

export async function createPackedArchive(root: string): Promise<PackedArchive> {
  const tar = Bun.which("tar");
  if (!tar) throw new Error("The system tar utility is required to inspect Bun package archives");

  const workspace = await mkdtemp(join(tmpdir(), "dokion-package-"));
  const packed = join(workspace, "packed");
  const extracted = join(workspace, "extracted");
  await mkdir(packed, { recursive: true });
  await mkdir(extracted, { recursive: true });

  try {
    await run([process.execPath, "pm", "pack", "--ignore-scripts", "--quiet", "--destination", packed], root);
    const archivePath = await onlyTarball(packed);
    await run([tar, "-xzf", archivePath, "-C", extracted], root);
    const extractedRoot = join(extracted, "package");
    if (!(await Bun.file(join(extractedRoot, "package.json")).exists())) {
      throw new Error("Bun package archive did not contain package/package.json");
    }
    const files = await listRegularFiles(extractedRoot);
    return { workspace, archivePath, extractedRoot, files };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export async function readPackedText(archive: PackedArchive, path: string): Promise<string> {
  const absolute = join(archive.extractedRoot, path);
  const normalized = relative(archive.extractedRoot, absolute);
  if (normalized.startsWith("..") || normalized.includes("../")) throw new Error(`Unsafe packed path: ${path}`);
  return readFile(absolute, "utf8");
}

export async function removePackedArchive(archive: PackedArchive): Promise<void> {
  await rm(archive.workspace, { recursive: true, force: true });
}
