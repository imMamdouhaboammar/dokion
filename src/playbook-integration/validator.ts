import * as fs from 'fs';
import * as path from 'path';

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  file?: string;
}

export interface SkillValidationResult {
  skillName: string;
  valid: boolean;
  issues: ValidationIssue[];
}

export class PlaybookSkillValidator {
  public validateSkillDirectory(skillDir: string): SkillValidationResult {
    const skillName = path.basename(skillDir);
    const issues: ValidationIssue[] = [];

    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      issues.push({
        type: 'ERROR',
        code: 'MISSING_SKILL_MD',
        message: `SKILL.md is missing in ${skillDir}`,
        file: skillMdPath,
      });
      return { skillName, valid: false, issues };
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');

    // 1. Check YAML frontmatter
    if (!content.startsWith('---')) {
      issues.push({
        type: 'ERROR',
        code: 'MISSING_FRONTMATTER',
        message: 'SKILL.md must start with YAML frontmatter delimiter (---)',
        file: skillMdPath,
      });
    } else {
      if (!/name:\s*[\w-]+/i.test(content)) {
        issues.push({
          type: 'ERROR',
          code: 'MISSING_NAME',
          message: 'YAML frontmatter missing valid "name"',
          file: skillMdPath,
        });
      }
      if (!/description:\s*.+/i.test(content)) {
        issues.push({
          type: 'WARNING',
          code: 'MISSING_DESCRIPTION',
          message: 'YAML frontmatter missing "description"',
          file: skillMdPath,
        });
      }
    }

    // 2. Check structure sections
    if (!content.includes('# ') && !content.includes('## ')) {
      issues.push({
        type: 'WARNING',
        code: 'NO_HEADINGS',
        message: 'SKILL.md should contain markdown headings',
        file: skillMdPath,
      });
    }

    // 3. Check for references or scripts directory if mentioned
    if (content.includes('references/') && !fs.existsSync(path.join(skillDir, 'references'))) {
      issues.push({
        type: 'WARNING',
        code: 'MISSING_REFERENCES_DIR',
        message: 'SKILL.md references "references/" directory but it does not exist',
        file: skillMdPath,
      });
    }

    // 4. Check README / README.zh-CN.md bilingual parity if present
    const readmeEn = path.join(skillDir, 'README.md');
    const readmeZh = path.join(skillDir, 'README.zh-CN.md');
    if (fs.existsSync(readmeEn) && !fs.existsSync(readmeZh)) {
      issues.push({
        type: 'WARNING',
        code: 'BILINGUAL_PARITY_WARNING',
        message: 'README.md exists without corresponding README.zh-CN.md',
        file: readmeZh,
      });
    }

    const valid = !issues.some((i) => i.type === 'ERROR');
    return { skillName, valid, issues };
  }

  public validateSkillsInDirectory(skillsParentDir: string): SkillValidationResult[] {
    if (!fs.existsSync(skillsParentDir)) {
      return [];
    }
    const results: SkillValidationResult[] = [];
    const entries = fs.readdirSync(skillsParentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = this.validateSkillDirectory(path.join(skillsParentDir, entry.name));
        results.push(result);
      }
    }

    return results;
  }
}
