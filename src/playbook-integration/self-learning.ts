import * as fs from 'fs';
import * as path from 'path';

export interface LearningArtifact {
  id: string;
  sourceSessionId: string;
  category: 'BUG_FIX' | 'PATTERN_IMPROVEMENT' | 'PERFORMANCE' | 'DOCS';
  summary: string;
  observedIssue: string;
  proposedSolution: string;
  timestamp: string;
}

export interface ProposalRecord {
  id: string;
  learningId: string;
  title: string;
  status: 'PROPOSED' | 'VALIDATED' | 'ACCEPTED' | 'REJECTED';
  proposalPath: string;
  timestamp: string;
}

export class SelfImprovingEngine {
  private projectRoot: string;
  private proposalsDir: string;
  private learningsPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.proposalsDir = path.join(projectRoot, '.dokion', 'learnings', 'proposals');
    this.learningsPath = path.join(projectRoot, '.dokion', 'learnings', 'index.json');
  }

  public recordLearning(learning: Omit<LearningArtifact, 'id' | 'timestamp'>): LearningArtifact {
    const timestamp = new Date().toISOString();
    const id = `learn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const fullLearning: LearningArtifact = {
      ...learning,
      id,
      timestamp,
    };

    const learnings = this.loadLearnings();
    learnings.push(fullLearning);
    this.saveLearnings(learnings);

    this.generateProposal(fullLearning);

    return fullLearning;
  }

  public generateProposal(learning: LearningArtifact): ProposalRecord {
    if (!fs.existsSync(this.proposalsDir)) {
      fs.mkdirSync(this.proposalsDir, { recursive: true });
    }

    const proposalFileName = `${learning.id}-${learning.category.toLowerCase()}.md`;
    const proposalPath = path.join(this.proposalsDir, proposalFileName);

    const proposalMarkdown = `# Improvement Proposal: ${learning.summary}

**Proposal ID**: \`${learning.id}\`
**Session**: \`${learning.sourceSessionId}\`
**Category**: \`${learning.category}\`
**Timestamp**: ${learning.timestamp}

## Observed Issue
${learning.observedIssue}

## Proposed Solution
${learning.proposedSolution}

## Quality Gate Check
- [ ] Validated against existing playbooks and skills
- [ ] No regression in core runtime engine
- [ ] Unit and contract tests added
`;

    fs.writeFileSync(proposalPath, proposalMarkdown, 'utf-8');

    return {
      id: `prop-${learning.id}`,
      learningId: learning.id,
      title: learning.summary,
      status: 'PROPOSED',
      proposalPath,
      timestamp: learning.timestamp,
    };
  }

  public loadLearnings(): LearningArtifact[] {
    if (!fs.existsSync(this.learningsPath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.learningsPath, 'utf-8');
      return JSON.parse(content) as LearningArtifact[];
    } catch {
      return [];
    }
  }

  private saveLearnings(learnings: LearningArtifact[]): void {
    const dir = path.dirname(this.learningsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.learningsPath, JSON.stringify(learnings, null, 2), 'utf-8');
  }
}
