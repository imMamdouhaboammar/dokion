import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { validatePlaybookData } from "../contracts/schema-validator.ts";
import { sha256, sha256File } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import type { DokionPlaybook, LoadedPlaybook } from "./types.ts";

export const ACTIVE_PLAYBOOK_PATH = ".dokion/playbook.json";

export async function loadActivePlaybook(root: string): Promise<LoadedPlaybook> {
  const path = join(root, ACTIVE_PLAYBOOK_PATH);
  if (!(await Bun.file(path).exists())) {
    throw new DokionError("NO_ACTIVE_PLAYBOOK", `No active playbook exists at ${ACTIVE_PLAYBOOK_PATH}`, {
      path: ACTIVE_PLAYBOOK_PATH,
      schema: "schemas/dokion-playbook.schema.json"
    });
  }

  const raw = await readFile(path, "utf8");
  let data: DokionPlaybook;
  try {
    data = JSON.parse(raw) as DokionPlaybook;
  } catch (error) {
    throw new DokionError("INVALID_JSON", `Active playbook is not valid JSON`, {
      path: ACTIVE_PLAYBOOK_PATH,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const issues = await validatePlaybookData(root, data, ACTIVE_PLAYBOOK_PATH);
  if (issues.length > 0) {
    throw new DokionError("INVALID_PLAYBOOK", "Active playbook failed schema validation", {
      path: ACTIVE_PLAYBOOK_PATH,
      issues
    });
  }

  if (raw.includes("sha256:PLACEHOLDER")) {
    throw new DokionError("UNPINNED_CAPABILITY", "Active playbook contains placeholder capability digests", {
      path: ACTIVE_PLAYBOOK_PATH
    });
  }

  return {
    path,
    raw,
    data,
    digest: sha256(raw)
  };
}

export async function assertPlaybookUnchanged(loaded: LoadedPlaybook): Promise<void> {
  const observed = await sha256File(loaded.path);
  if (observed !== loaded.digest) {
    throw new DokionError("PLAYBOOK_TAINTED", "The active playbook changed after the run started", {
      expected: loaded.digest,
      observed,
      path: ACTIVE_PLAYBOOK_PATH
    });
  }
}
