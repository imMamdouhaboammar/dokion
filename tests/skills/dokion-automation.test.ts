import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Dokion Automation Skill Set Verification', () => {
  const skillPath = join(process.cwd(), 'skills/dokion-automation/SKILL.md');
  const referencePath = join(process.cwd(), 'skills/dokion-automation/references/playbook-authoring.md');

  test('skill markdown file exists and contains YAML frontmatter', () => {
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('name: dokion-automation');
    expect(content).toContain('description:');
    expect(content).toContain('dokion autopilot');
  });

  test('reference authoring guide exists and contains valid schema details', () => {
    expect(existsSync(referencePath)).toBe(true);
    const content = readFileSync(referencePath, 'utf8');
    expect(content).toContain('Dokion Playbook Authoring');
    expect(content).toContain('approval');
  });
});
