import * as path from "path";
import { AgentPlaybookImporter } from "../../playbook-integration/importer.js";
import { PlaybookSkillValidator } from "../../playbook-integration/validator.js";
import { writeCliResult } from "../output.js";

export async function handlePlaybooksCommand(args: string[], cwd: string = process.cwd()): Promise<number> {
  const subcommand = args[0] || "list";

  if (subcommand === "import") {
    const fromIdx = args.indexOf("--from");
    const sourcePath = fromIdx !== -1 && args[fromIdx + 1] ? args[fromIdx + 1]! : "/tmp/agent-playbook";

    try {
      const importer = new AgentPlaybookImporter(cwd);
      const imported = importer.importFromDirectory({ sourcePath, overwrite: true });
      writeCliResult(
        {
          status: "SUCCESS",
          message: `Successfully imported ${imported.length} skills from agent-playbook`,
          skills: imported
        },
        "human"
      );
      return 0;
    } catch (err: unknown) {
      writeCliResult(
        {
          status: "ERROR",
          message: err instanceof Error ? err.message : String(err)
        },
        "human"
      );
      return 1;
    }
  }

  if (subcommand === "validate") {
    const validator = new PlaybookSkillValidator();
    const skillsDir = path.join(cwd, "skills");
    const results = validator.validateSkillsInDirectory(skillsDir);

    const hasErrors = results.some((result) => !result.valid);
    writeCliResult(
      {
        status: hasErrors ? "FAILED" : "SUCCESS",
        validatedCount: results.length,
        results
      },
      "human"
    );
    return hasErrors ? 1 : 0;
  }

  if (subcommand === "sync") {
    writeCliResult(
      {
        status: "ERROR",
        code: "REGISTRY_NOT_IMPLEMENTED",
        message:
          "Playbook sync is unavailable until verified Registry sources, project lockfiles, and atomic install transitions are implemented."
      },
      "human"
    );
    return 1;
  }

  writeCliResult(
    {
      subcommands: ["import", "validate", "sync", "list"],
      modules: ["Lifecycle Hooks", "Skill Importer", "Playbook Validator", "Self-Learning", "Orchestrator"],
      syncStatus: "UNAVAILABLE"
    },
    "human"
  );
  return 0;
}
