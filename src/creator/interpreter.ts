import type { ExtractedActionStep, MemoryEntry } from "./types.js";

const COMMAND_START = "(?:bun|npm|pnpm|npx|git|python3?|cargo|go|docker)";
const COMMAND_TOKEN = "[A-Za-z0-9_./:@=,+%\\-]+";
const COMMAND_BOUNDARY = "(?:and|then|or|with|before|after|while|continue|execute|run)";
const DANGEROUS_SHELL_SYNTAX = /[;&|<>$`\r\\]/;
const SAFE_COMMAND = new RegExp(`^${COMMAND_START}(?:\\s+${COMMAND_TOKEN})+$`);
const COMMAND_PATTERN = new RegExp(
  `\\b${COMMAND_START}\\s+${COMMAND_TOKEN}(?:\\s+(?!${COMMAND_BOUNDARY}\\b)${COMMAND_TOKEN}){0,7}`,
  "gi"
);

function extractSafeCommands(content: string): string[] {
  const commands: string[] = [];

  for (const line of content.split("\n")) {
    if (DANGEROUS_SHELL_SYNTAX.test(line)) continue;

    for (const match of line.matchAll(COMMAND_PATTERN)) {
      const command = match[0]?.trim().replace(/[.,:]+$/, "");
      if (!command || command.length > 512 || !SAFE_COMMAND.test(command)) continue;
      if (!commands.includes(command)) commands.push(command);
    }
  }

  return commands;
}

export class PlaybookInterpreter {
  public parseMemories(memories: MemoryEntry[], topicFilter?: string): ExtractedActionStep[] {
    const steps: ExtractedActionStep[] = [];
    let stepCount = 0;

    for (const entry of memories) {
      if (topicFilter && !entry.content.toLowerCase().includes(topicFilter.toLowerCase()) && !entry.title.toLowerCase().includes(topicFilter.toLowerCase())) {
        continue;
      }

      const commandMatches = extractSafeCommands(entry.content);
      const skillMatches = commandMatches.filter((command) => /^npx\s+skills\s+add\s+/i.test(command));

      const extractedSkills: string[] = [];
      for (const skillMatch of skillMatches) {
        const repo = skillMatch.replace(/^npx\s+skills\s+add\s+/i, "").trim();
        if (repo && !extractedSkills.includes(repo)) {
          extractedSkills.push(repo);
        }
      }

      if (extractedSkills.length > 0) {
        stepCount++;
        steps.push({
          id: `step-${stepCount}-install-skills`,
          title: "Install Required Skills",
          description: `Install explicitly referenced skills after user approval: ${extractedSkills.join(", ")}`,
          command: `npx skills add ${extractedSkills.join(" ")}`,
          skillsToAdd: extractedSkills,
          verificationCommands: ["npx skills --version"],
          category: entry.category || "general",
        });
      }

      for (const command of commandMatches) {
        if (/^npx\s+skills\s+add\s+/i.test(command)) continue;
        if (steps.some((step) => step.command === command)) continue;

        stepCount++;
        const isTest = command.includes("test");
        const isTypecheck = command.includes("typecheck") || command.includes("tsc");
        const isLint = command.includes("lint") || command.includes("format");

        let title = `Execute Command: ${command}`;
        if (isTest) title = "Run Verification Test Suite";
        else if (isTypecheck) title = "Verify Static Type Safety";
        else if (isLint) title = "Enforce Linter Rules";

        steps.push({
          id: `step-${stepCount}-${isTest ? "test" : isTypecheck ? "typecheck" : "exec"}`,
          title,
          description: `Execute approved command: ${command}`,
          command,
          verificationCommands: isTest || isTypecheck ? [command] : ["git status --short"],
          category: isLint ? "unslop" : entry.category || "general",
        });
      }
    }

    if (steps.length === 0) {
      steps.push({
        id: "step-1-baseline-validation",
        title: "Repository Baseline Verification",
        description: "No safe executable command was found in memory. Run the repository test suite as a baseline only.",
        command: "bun test",
        verificationCommands: ["bun test", "git status --short"],
        category: "testing",
      });
    }

    return steps;
  }
}
