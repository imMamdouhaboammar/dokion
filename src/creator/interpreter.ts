import type { ExtractedActionStep, MemoryEntry } from "./types.js";

export class PlaybookInterpreter {
  public parseMemories(memories: MemoryEntry[], topicFilter?: string): ExtractedActionStep[] {
    const steps: ExtractedActionStep[] = [];
    let stepCount = 0;

    for (const entry of memories) {
      if (topicFilter && !entry.content.toLowerCase().includes(topicFilter.toLowerCase()) && !entry.title.toLowerCase().includes(topicFilter.toLowerCase())) {
        continue;
      }

      // 1. Scan for explicit shell commands / scripts
      const commandMatches = entry.content.match(/(?:bun|npm|pnpm|npx|git|python3?|cargo|go|docker)\s+[^\n`]+/g) || [];
      const skillMatches = entry.content.match(/npx\s+skills\s+add\s+([^\s\n`]+)/g) || [];

      // Extract skills
      const extractedSkills: string[] = [];
      for (const skillMatch of skillMatches) {
        const repo = skillMatch.replace(/npx\s+skills\s+add\s+/, "").trim();
        if (repo && !extractedSkills.includes(repo)) {
          extractedSkills.push(repo);
        }
      }

      if (extractedSkills.length > 0) {
        stepCount++;
        steps.push({
          id: `step-${stepCount}-install-skills`,
          title: `Install Required Skills`,
          description: `Dynamically install skills via npx skills add: ${extractedSkills.join(", ")}`,
          command: `npx skills add ${extractedSkills.join(" ")}`,
          skillsToAdd: extractedSkills,
          verificationCommands: ["npx skills --version || true"],
          category: entry.category || "general",
        });
      }

      // Process matched commands
      for (const cmd of commandMatches) {
        const cleanCmd = cmd.trim();

        // Skip duplicates or trivial commands
        if (cleanCmd.length < 3 || steps.some((s) => s.command === cleanCmd)) {
          continue;
        }

        stepCount++;
        const isTest = cleanCmd.includes("test");
        const isTypecheck = cleanCmd.includes("typecheck") || cleanCmd.includes("tsc");
        const isLint = cleanCmd.includes("lint") || cleanCmd.includes("format");

        let title = `Execute Command: ${cleanCmd}`;
        if (isTest) title = `Run Verification Test Suite`;
        else if (isTypecheck) title = `Verify Static Type Safety`;
        else if (isLint) title = `Enforce Linter & Unslop Rules`;

        steps.push({
          id: `step-${stepCount}-${isTest ? "test" : isTypecheck ? "typecheck" : "exec"}`,
          title,
          description: `Execute verified step: ${cleanCmd}`,
          command: cleanCmd,
          verificationCommands: isTest || isTypecheck ? [cleanCmd] : ["git status --short"],
          category: isLint ? "unslop" : entry.category || "general",
        });
      }

      // 2. If no explicit commands found, synthesize a step from title and content summary
      if (commandMatches.length === 0 && extractedSkills.length === 0 && entry.content.length > 20) {
        stepCount++;
        const summary = entry.content.slice(0, 120).replace(/\n/g, " ");
        steps.push({
          id: `step-${stepCount}-concept`,
          title: entry.title || `Workflow Action Step ${stepCount}`,
          description: summary,
          command: `echo "Executing: ${entry.title.replace(/"/g, '\\"')}"`,
          verificationCommands: ["git status --short"],
          category: entry.category || "general",
        });
      }
    }

    // Default fallback step if no memories resulted in steps
    if (steps.length === 0) {
      steps.push({
        id: "step-1-baseline-validation",
        title: "Repository Baseline Verification",
        description: "Run test suite and verify repository working tree state.",
        command: "bun test",
        verificationCommands: ["bun test", "git status --short"],
        category: "testing",
      });
    }

    return steps;
  }
}
