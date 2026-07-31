import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ACTIVE_PLAYBOOK_PATH, loadActivePlaybook } from "../../playbook/load-playbook.ts";

export interface ConfigureCommandOptions {
  activateProposed?: boolean;
}

export interface ConfigureCommandResult {
  path: string;
  configured: boolean;
  version: string;
  stagesCount: number;
  releaseGatesCount: number;
  digest: string;
  message: string;
}

export async function handleConfigureCommand(
  root: string,
  options: ConfigureCommandOptions = {}
): Promise<ConfigureCommandResult> {
  await mkdir(join(root, ".dokion"), { recursive: true });
  const activePath = join(root, ACTIVE_PLAYBOOK_PATH);
  const proposedPath = join(root, ".dokion/playbook.proposed.json");
  const referencePath = join(root, "playbooks/reference/agent-playbook.json");

  const activeExists = await Bun.file(activePath).exists();

  if (!activeExists || options.activateProposed) {
    let sourceContent: string | null = null;
    if (await Bun.file(proposedPath).exists()) {
      sourceContent = await readFile(proposedPath, "utf8");
    } else if (await Bun.file(referencePath).exists()) {
      sourceContent = await readFile(referencePath, "utf8");
    }

    if (sourceContent) {
      const pinnedContent = sourceContent.replaceAll(
        "sha256:PLACEHOLDER",
        `sha256:${"0".repeat(64)}`
      );
      await writeFile(activePath, pinnedContent, "utf8");
    }
  }

  const loaded = await loadActivePlaybook(root);

  return {
    path: loaded.path,
    configured: true,
    version: loaded.data.version,
    stagesCount: loaded.data.stages.length,
    releaseGatesCount: loaded.data.release_gates?.length ?? 0,
    digest: loaded.digest,
    message: `Configured active playbook v${loaded.data.version} with ${loaded.data.stages.length} stage(s)`
  };
}
