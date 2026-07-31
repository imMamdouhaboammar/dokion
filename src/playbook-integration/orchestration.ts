import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowStage {
  id: string;
  name: string;
  skillName: string;
  description: string;
  requiredInputKeys: string[];
  outputArtifactKey?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
}

export interface WorkflowPlan {
  id: string;
  title: string;
  version: string;
  stages: WorkflowStage[];
}

export class WorkflowOrchestrator {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public createStandardPRDWorkflow(title: string): WorkflowPlan {
    return {
      id: `wf-prd-${Date.now()}`,
      title: `PRD-to-Delivery Workflow: ${title}`,
      version: '1.0.0',
      stages: [
        {
          id: 'stage-prd',
          name: 'PRD Planning',
          skillName: 'prd-planner',
          description: 'Generates persistent file-based PRD planning artifacts',
          requiredInputKeys: ['requirements'],
          outputArtifactKey: 'prd_file',
          status: 'PENDING',
        },
        {
          id: 'stage-precheck',
          name: 'Pre-implementation Check',
          skillName: 'prd-implementation-precheck',
          description: 'Performs preflight checks against code architecture before implementation',
          requiredInputKeys: ['prd_file'],
          status: 'PENDING',
        },
        {
          id: 'stage-implementation',
          name: 'Core Implementation',
          skillName: 'refactoring-specialist',
          description: 'Executes planned code changes with minimal diff discipline',
          requiredInputKeys: ['prd_file'],
          status: 'PENDING',
        },
        {
          id: 'stage-review',
          name: 'Code & Security Review',
          skillName: 'code-reviewer',
          description: 'Performs static analysis, code quality, and security checks',
          requiredInputKeys: ['diff'],
          status: 'PENDING',
        },
        {
          id: 'stage-self-learning',
          name: 'Self-Improvement Capture',
          skillName: 'self-improving-agent',
          description: 'Captures learning artifacts and generates improvement proposals',
          requiredInputKeys: ['session_log'],
          status: 'PENDING',
        },
      ],
    };
  }

  public saveWorkflowPlan(plan: WorkflowPlan, outputPath?: string): string {
    const targetPath =
      outputPath || path.join(this.projectRoot, '.dokion', 'workflows', `${plan.id}.json`);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, JSON.stringify(plan, null, 2), 'utf-8');
    return targetPath;
  }
}
