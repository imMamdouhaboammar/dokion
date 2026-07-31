import * as fs from 'fs';
import * as path from 'path';

export interface ImportedSkillSummary {
  name: string;
  description: string;
  category: string;
  skillPath: string;
  hasHooks: boolean;
}

export interface ImportOptions {
  sourcePath: string;
  targetSkillsDir?: string;
  overwrite?: boolean;
}

export class AgentPlaybookImporter {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public importFromDirectory(options: ImportOptions): ImportedSkillSummary[] {
    const { sourcePath, overwrite = false } = options;
    const targetDir = options.targetSkillsDir || path.join(this.projectRoot, 'skills');

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    const imported: ImportedSkillSummary[] = [];

    // Check if sourcePath has catalog.json or skills directory
    const skillsDir = fs.existsSync(path.join(sourcePath, 'skills'))
      ? path.join(sourcePath, 'skills')
      : sourcePath;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillName = entry.name;
        const skillSourceDir = path.join(skillsDir, skillName);
        const skillMdPath = path.join(skillSourceDir, 'SKILL.md');

        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          const description = this.extractDescription(content);
          const category = this.extractCategory(content) || 'uncategorized';
          const hasHooks = content.includes('hooks:') || content.includes('metadata.hooks');

          const destSkillDir = path.join(targetDir, skillName);
          if (!fs.existsSync(destSkillDir) || overwrite) {
            this.copyDirRecursive(skillSourceDir, destSkillDir);
          }

          imported.push({
            name: skillName,
            description,
            category,
            skillPath: destSkillDir,
            hasHooks,
          });
        }
      }
    }

    return imported;
  }

  private extractDescription(content: string): string {
    const match = content.match(/description:\s*(["']?)([^"'\n]+)\1/i);
    return match && match[2] ? match[2].trim() : 'No description provided';
  }

  private extractCategory(content: string): string {
    const match = content.match(/category:\s*(["']?)([^"'\n]+)\1/i);
    return match && match[2] ? match[2].trim() : '';
  }

  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
