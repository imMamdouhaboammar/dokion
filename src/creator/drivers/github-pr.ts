import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryDriver, MemoryEntry, MemorySourceType } from "../types.js";

export interface PrComment {
  author?: string;
  body: string;
  createdAt?: string;
}

export interface PrDiscussion {
  prNumber?: number;
  title: string;
  comments: PrComment[];
}

export interface IssueDiscussion {
  issueNumber?: number;
  title: string;
  comments: PrComment[];
}

export class GitHubPrDriver implements MemoryDriver {
  public name: MemorySourceType;

  constructor(driverName: MemorySourceType = "github-pr") {
    this.name = driverName;
  }

  public async fetchMemories(options?: {
    prDumpPath?: string;
    customPrs?: PrDiscussion[];
    customIssues?: IssueDiscussion[];
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    try {
      // 1. Process custom PR discussions
      if (options?.customPrs && options.customPrs.length > 0) {
        options.customPrs.forEach((pr, prIdx) => {
          const prNumStr = pr.prNumber ? `#${pr.prNumber}` : `${prIdx + 1}`;
          pr.comments.forEach((c, cIdx) => {
            memories.push({
              id: `gh-pr-${pr.prNumber || prIdx}-${cIdx}`,
              source: "github-pr",
              timestamp: c.createdAt || new Date().toISOString(),
              title: `PR ${prNumStr}: ${pr.title}`,
              content: c.author ? `[${c.author}]: ${c.body}` : c.body,
              category: "general",
              metadata: { prNumber: pr.prNumber, author: c.author },
            });
          });
        });
      }

      // 2. Process custom Issue discussions
      if (options?.customIssues && options.customIssues.length > 0) {
        options.customIssues.forEach((issue, issueIdx) => {
          const issueNumStr = issue.issueNumber ? `#${issue.issueNumber}` : `${issueIdx + 1}`;
          issue.comments.forEach((c, cIdx) => {
            memories.push({
              id: `gh-issue-${issue.issueNumber || issueIdx}-${cIdx}`,
              source: "github-issue",
              timestamp: c.createdAt || new Date().toISOString(),
              title: `Issue ${issueNumStr}: ${issue.title}`,
              content: c.author ? `[${c.author}]: ${c.body}` : c.body,
              category: "general",
              metadata: { issueNumber: issue.issueNumber, author: c.author },
            });
          });
        });
      }

      // 3. Local PR / Issue dump file check (.dokion/github-discussions.json)
      const dumpPath = options?.prDumpPath || join(process.cwd(), ".dokion", "github-discussions.json");
      if (existsSync(dumpPath)) {
        const raw = readFileSync(dumpPath, "utf-8");
        const parsed = JSON.parse(raw);
        const prs = Array.isArray(parsed.prs) ? parsed.prs : [];
        prs.forEach((pr: PrDiscussion, prIdx: number) => {
          const prNumStr = pr.prNumber ? `#${pr.prNumber}` : `${prIdx + 1}`;
          (pr.comments || []).forEach((c, cIdx) => {
            memories.push({
              id: `local-gh-pr-${pr.prNumber || prIdx}-${cIdx}`,
              source: "github-pr",
              timestamp: c.createdAt || new Date().toISOString(),
              title: `PR ${prNumStr}: ${pr.title}`,
              content: c.author ? `[${c.author}]: ${c.body}` : c.body,
              category: "general",
              metadata: { prNumber: pr.prNumber, author: c.author },
            });
          });
        });
      }
    } catch {
      // Return accumulated memories gracefully
    }

    return memories;
  }
}
