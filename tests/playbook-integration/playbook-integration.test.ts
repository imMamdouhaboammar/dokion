import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

import {
  LifecycleHookEngine,
  AgentPlaybookImporter,
  PlaybookSkillValidator,
  SelfImprovingEngine,
  WorkflowOrchestrator,
} from '../../src/playbook-integration/index.js';
import { handlePlaybooksCommand } from '../../src/cli/handlers/playbooks.js';
import { handleHooksCommand } from '../../src/cli/handlers/hooks.ts';

describe('Agent Playbook Integration Suite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-playbook-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('LifecycleHookEngine parses frontmatter hooks and evaluates triggers', () => {
    const engine = new LifecycleHookEngine(tmpDir);
    const markdown = `---
name: sample-skill
description: Test skill with hooks
hooks:
  - targetSkill: self-improving-agent
    mode: background
    reason: Capture learning artifacts
  - targetSkill: code-reviewer
    mode: ask_first
    reason: Confirm post-implementation review
---

# Sample Skill Content
`;

    const parsed = engine.parseHooksFromFrontmatter(markdown);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.targetSkill).toBe('self-improving-agent');
    expect(parsed[0]?.mode).toBe('background');
    expect(parsed[1]?.mode).toBe('ask_first');

    const triggered = engine.evaluateTrigger('sample-skill', parsed);
    expect(triggered).toHaveLength(2);
    expect(triggered[0]?.status).toBe('PENDING');
    expect(triggered[1]?.status).toBe('AWAITING_USER');

    const state = engine.getHooksState();
    expect(state.history.length).toBeGreaterThanOrEqual(2);
  });

  test('AgentPlaybookImporter copies skill directories', () => {
    const importer = new AgentPlaybookImporter(tmpDir);

    // Create source skill
    const sourceDir = path.join(tmpDir, 'source-skills');
    const skillPath = path.join(sourceDir, 'test-skill');
    fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(
      path.join(skillPath, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test importer\n---\n# Test'
    );

    const imported = importer.importFromDirectory({ sourcePath: sourceDir });
    expect(imported).toHaveLength(1);
    expect(imported[0]?.name).toBe('test-skill');
    expect(fs.existsSync(path.join(tmpDir, 'skills', 'test-skill', 'SKILL.md'))).toBeTrue();
  });

  test('PlaybookSkillValidator validates skill structures', () => {
    const validator = new PlaybookSkillValidator();
    const skillDir = path.join(tmpDir, 'valid-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: valid-skill\ndescription: Valid skill\n---\n# Valid Skill\nContent'
    );

    const res = validator.validateSkillDirectory(skillDir);
    expect(res.valid).toBeTrue();
    expect(res.issues).toHaveLength(0);
  });

  test('SelfImprovingEngine records learnings and generates proposal documents', () => {
    const engine = new SelfImprovingEngine(tmpDir);
    const artifact = engine.recordLearning({
      sourceSessionId: 'session-123',
      category: 'BUG_FIX',
      summary: 'Fix Null Pointer in Parser',
      observedIssue: 'Unhandled undefined token during command parsing',
      proposedSolution: 'Add optional chaining and default fallback values',
    });

    expect(artifact.id).toBeDefined();
    expect(fs.existsSync(path.join(tmpDir, '.dokion', 'learnings', 'index.json'))).toBeTrue();

    const proposalPath = path.join(
      tmpDir,
      '.dokion',
      'learnings',
      'proposals',
      `${artifact.id}-bug_fix.md`
    );
    expect(fs.existsSync(proposalPath)).toBeTrue();
  });

  test('WorkflowOrchestrator generates and saves standard PRD workflow plan', () => {
    const orchestrator = new WorkflowOrchestrator(tmpDir);
    const plan = orchestrator.createStandardPRDWorkflow('User Authentication System');
    expect(plan.stages).toHaveLength(5);

    const savedPath = orchestrator.saveWorkflowPlan(plan);
    expect(fs.existsSync(savedPath)).toBeTrue();
  });

  test('handlePlaybooksCommand and handleHooksCommand execute subcommands cleanly', async () => {
    const playbooksExit = await handlePlaybooksCommand(['list'], tmpDir);
    expect(playbooksExit).toBe(0);

    const hooksRunExit = await handleHooksCommand(['run'], tmpDir);
    expect(hooksRunExit).toBe(0);

    const hooksStatusExit = await handleHooksCommand(['status'], tmpDir);
    expect(hooksStatusExit).toBe(0);
  });
});
