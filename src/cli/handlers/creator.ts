import { PlaybookCreatorEngine } from "../../creator/engine.js";
import type { MemorySourceType } from "../../creator/types.js";

export interface CreatorCliOptions {
  fromMemory?: string;
  transcript?: string;
  topic?: string;
  output?: string;
}

export async function handleCreatorCommand(options: CreatorCliOptions): Promise<void> {
  const engine = new PlaybookCreatorEngine();

  const sourceMap: Record<string, MemorySourceType> = {
    "agent-kernel": "agent-kernel",
    kernel: "agent-kernel",
    transcript: "transcript",
    mem0: "mem0",
    workflow: "workflow-optimizer",
    "workflow-optimizer": "workflow-optimizer",
    "vector-db": "vector-db",
    vectordb: "vector-db",
    qdrant: "qdrant",
    chromadb: "chromadb",
    chroma: "chromadb",
    "knowledge-graph": "knowledge-graph",
    graph: "knowledge-graph",
    kg: "knowledge-graph",
    adr: "adr",
    adrs: "adr",
    "github-pr": "github-pr",
    pr: "github-pr",
    prs: "github-pr",
    "github-issue": "github-issue",
    issue: "github-issue",
    issues: "github-issue",
  };

  const source = options.fromMemory ? sourceMap[options.fromMemory.toLowerCase()] : undefined;

  console.log("⚡ [Dokion Playbook Creator] Analyzing memory & synthesizing Playbook...");

  try {
    const result = await engine.createPlaybook({
      source,
      transcriptPath: options.transcript,
      topic: options.topic,
      outputPath: options.output,
    });

    console.log(`✅ [Playbook Creator] Successfully created Playbook at: ${result.playbookPath}`);
    console.log(`   • Title: "${result.playbook.metadata.title}"`);
    console.log(`   • Steps Compiled: ${result.extractedStepsCount}`);
    console.log(`   • Memory Entries Processed: ${result.memoryEntriesProcessed}`);
    console.log(`   • SHA-256 Lock Digest: ${result.digest}`);
    console.log(`\nTo validate and run your new playbook, execute:\n   dokion validate\n   dokion run\n`);
  } catch (err: any) {
    console.error(`❌ [Playbook Creator Error]: ${err.message || String(err)}`);
    process.exitCode = 1;
  }
}
