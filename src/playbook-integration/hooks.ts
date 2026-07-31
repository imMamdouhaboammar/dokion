import * as fs from 'fs';
import * as path from 'path';

export type HookFollowUpMode = 'auto' | 'background' | 'ask_first';

export interface SkillHookDeclaration {
  triggerSkill?: string;
  targetSkill: string;
  mode: HookFollowUpMode;
  reason?: string;
  params?: Record<string, unknown>;
}

export interface HookExecutionRecord {
  id: string;
  triggerSkill: string;
  targetSkill: string;
  mode: HookFollowUpMode;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'SKIPPED' | 'AWAITING_USER';
  timestamp: string;
  reason?: string;
}

export interface HooksState {
  version: string;
  updatedAt: string;
  declarations: SkillHookDeclaration[];
  history: HookExecutionRecord[];
}

export class LifecycleHookEngine {
  private projectRoot: string;
  private statePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = path.join(projectRoot, '.dokion', 'hooks_state.json');
  }

  public parseHooksFromFrontmatter(markdownContent: string): SkillHookDeclaration[] {
    const hooks: SkillHookDeclaration[] = [];
    const yamlMatch = markdownContent.match(/^---\s*[\s\S]*?---/);
    if (!yamlMatch) return hooks;

    const yamlBlock = yamlMatch[0];
    const hooksMatch = yamlBlock.match(/hooks:\s*\n([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|\n---)/i);
    if (hooksMatch && hooksMatch[1]) {
      const block = hooksMatch[1];
      const items = block.split(/\n\s*-\s+/).filter((s) => s.trim().length > 0);

      for (const item of items) {
        const currentHook: Partial<SkillHookDeclaration> = {};
        const lines = item.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          const targetMatch = trimmed.match(/^(?:targetSkill:|- targetSkill:)\s*(["']?)([^"'\n]+)\1/i);
          if (targetMatch && targetMatch[2]) currentHook.targetSkill = targetMatch[2].trim();

          const modeMatch = trimmed.match(/^mode:\s*(["']?)([^"'\n]+)\1/i);
          if (modeMatch && modeMatch[2]) currentHook.mode = modeMatch[2].trim() as HookFollowUpMode;

          const triggerMatch = trimmed.match(/^triggerSkill:\s*(["']?)([^"'\n]+)\1/i);
          if (triggerMatch && triggerMatch[2]) currentHook.triggerSkill = triggerMatch[2].trim();

          const reasonMatch = trimmed.match(/^reason:\s*(["']?)([^"'\n]+)\1/i);
          if (reasonMatch && reasonMatch[2]) currentHook.reason = reasonMatch[2].trim();
        }

        if (currentHook.targetSkill) {
          hooks.push(this.normalizeHook(currentHook));
        }
      }
    }

    return hooks;
  }

  private normalizeHook(raw: Partial<SkillHookDeclaration>): SkillHookDeclaration {
    return {
      triggerSkill: raw.triggerSkill || '*',
      targetSkill: raw.targetSkill || 'unknown-skill',
      mode: (['auto', 'background', 'ask_first'].includes(raw.mode as string) ? raw.mode : 'auto') as HookFollowUpMode,
      reason: raw.reason || 'Lifecycle follow-up triggered',
      params: raw.params || {},
    };
  }

  public evaluateTrigger(completedSkill: string, hooks: SkillHookDeclaration[]): HookExecutionRecord[] {
    const triggered: HookExecutionRecord[] = [];
    const timestamp = new Date().toISOString();

    for (const hook of hooks) {
      if (hook.triggerSkill === '*' || hook.triggerSkill === completedSkill) {
        const record: HookExecutionRecord = {
          id: `hook-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          triggerSkill: completedSkill,
          targetSkill: hook.targetSkill,
          mode: hook.mode,
          status: hook.mode === 'ask_first' ? 'AWAITING_USER' : 'PENDING',
          timestamp,
          ...(hook.reason ? { reason: hook.reason } : {}),
        };
        triggered.push(record);
      }
    }

    this.saveState(triggered);
    return triggered;
  }

  public getHooksState(): HooksState {
    if (!fs.existsSync(this.statePath)) {
      return {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        declarations: [],
        history: [],
      };
    }
    try {
      const content = fs.readFileSync(this.statePath, 'utf-8');
      return JSON.parse(content) as HooksState;
    } catch {
      return {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        declarations: [],
        history: [],
      };
    }
  }

  private saveState(newRecords: HookExecutionRecord[]): void {
    const state = this.getHooksState();
    state.history.push(...newRecords);
    state.updatedAt = new Date().toISOString();

    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}
