import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export type MemoryMaturityLevel = 'M0' | 'M1' | 'M2' | 'M3';

export interface MemoryAuditFinding {
  level: 'ok' | 'warn' | 'fail';
  message: string;
}

export interface MemoryAuditSignals {
  memoryMd: boolean;
  memoryState: boolean;
  tiersDoc: boolean;
  hasWrite: boolean;
  hasRecall: boolean;
  hasHygiene: boolean;
  hasVerifier: boolean;
  budget: boolean;
  constraints: boolean;
  runLog: boolean;
  confidenceTags: boolean;
  durableHasOwner: boolean;
  secretHit: boolean;
  stateHuge: boolean;
}

export interface MemoryAuditResult {
  target: string;
  score: number;
  level: MemoryMaturityLevel;
  levelLabel: string;
  assessment: string;
  signals: MemoryAuditSignals;
  findings: MemoryAuditFinding[];
  recommendations: string[];
}

const SECRET_HINTS = [
  /api[_-]?key\s*[:=]\s*['"]?[a-z0-9_-]{16,}/i,
  /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/,
  /aws_secret_access_key/i,
  /xox[baprs]-[0-9a-zA-Z-]+/,
];

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readSafe(p: string): Promise<string> {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return '';
  }
}

async function listSkillNames(root: string): Promise<Set<string>> {
  const dirs = ['skills', '.agents/skills', '.grok/skills', '.claude/skills'];
  const names = new Set<string>();

  for (const d of dirs) {
    const full = path.join(root, d);
    if (!(await exists(full))) continue;
    try {
      const entries = await readdir(full, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          names.add(e.name.toLowerCase());
        } else if (e.isFile() && e.name.endsWith('.md')) {
          names.add(e.name.replace(/\.md$/i, '').toLowerCase());
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return names;
}

function levelFor(score: number, signals: MemoryAuditSignals): MemoryMaturityLevel {
  if (
    score >= 85 &&
    signals.hasHygiene &&
    signals.hasVerifier &&
    signals.budget &&
    signals.durableHasOwner
  ) {
    return 'M3';
  }
  if (score >= 65 && signals.budget && signals.hasHygiene) {
    return 'M2';
  }
  if (score >= 40 && signals.memoryMd && signals.memoryState) {
    return 'M1';
  }
  if (score >= 40) return 'M1';
  return 'M0';
}

function levelLabel(level: MemoryMaturityLevel): string {
  switch (level) {
    case 'M0':
      return 'ad-hoc';
    case 'M1':
      return 'structured';
    case 'M2':
      return 'budgeted';
    case 'M3':
      return 'gated durable';
  }
}

export async function auditMemoryRepository(target: string): Promise<MemoryAuditResult> {
  const root = path.resolve(target);
  const memoryMd = await readSafe(path.join(root, 'MEMORY.md'));
  const memoryState = await readSafe(path.join(root, 'MEMORY-STATE.md'));
  const budget = await readSafe(path.join(root, 'memory-budget.md'));
  const constraints = await readSafe(path.join(root, 'memory-constraints.md'));
  const runLog = await readSafe(path.join(root, 'memory-run-log.md'));
  const stateMd = await readSafe(path.join(root, 'STATE.md'));
  const skills = await listSkillNames(root);

  const hasWrite = [...skills].some((s) => s.includes('memory-write') || s === 'write');
  const hasRecall = [...skills].some((s) => s.includes('memory-recall') || s === 'recall');
  const hasHygiene = [...skills].some((s) => s.includes('memory-hygiene') || s === 'hygiene');
  const hasVerifier = [...skills].some((s) => s.includes('memory-verifier') || s.includes('verifier'));

  const tiersDoc =
    /scratch/i.test(memoryMd) &&
    /episodic/i.test(memoryMd) &&
    /durable/i.test(memoryMd);

  const confidenceTags =
    /\[observed\]|\[decided\]|\[hypothesis\]|confidence:\s*(observed|decided|hypothesis)/i.test(
      memoryState + memoryMd,
    );

  const durableSection = /##\s*Durable/i.test(memoryState);
  const durableHasOwner =
    !durableSection ||
    /owner\s*:|@\w+|evidence\s*:/i.test(
      memoryState.split(/##\s*Durable/i)[1]?.slice(0, 4000) || '',
    );

  const blob = memoryMd + memoryState + budget + constraints;
  const secretHit = SECRET_HINTS.some((re) => re.test(blob));

  const stateHuge = Buffer.byteLength(stateMd, 'utf8') > 100_000 && memoryState.length < 50;

  const signals: MemoryAuditSignals = {
    memoryMd: memoryMd.length > 40,
    memoryState: memoryState.length > 20,
    tiersDoc,
    hasWrite,
    hasRecall,
    hasHygiene,
    hasVerifier,
    budget: budget.length > 20,
    constraints: constraints.length > 20,
    runLog: runLog.length > 10,
    confidenceTags,
    durableHasOwner,
    secretHit,
    stateHuge,
  };

  let score = 10;
  const findings: MemoryAuditFinding[] = [];
  const recommendations: string[] = [];

  if (signals.memoryMd) {
    score += 16;
    findings.push({ level: 'ok', message: 'MEMORY.md present' });
  } else {
    findings.push({ level: 'fail', message: 'Missing MEMORY.md — memory posture undefined' });
    recommendations.push('dokion memory init . --pattern session-scratchpad');
  }

  if (signals.memoryState) {
    score += 14;
    findings.push({ level: 'ok', message: 'MEMORY-STATE.md present' });
  } else {
    findings.push({ level: 'fail', message: 'Missing MEMORY-STATE.md' });
    recommendations.push('dokion memory init . --pattern session-scratchpad');
  }

  if (signals.tiersDoc) {
    score += 8;
    findings.push({ level: 'ok', message: 'Tiers documented (scratch / episodic / durable)' });
  } else if (signals.memoryMd) {
    findings.push({ level: 'warn', message: 'MEMORY.md should document scratch, episodic, durable tiers' });
  }

  if (signals.hasWrite) {
    score += 8;
    findings.push({ level: 'ok', message: 'memory-write skill present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-write skill' });
  }

  if (signals.hasRecall) {
    score += 8;
    findings.push({ level: 'ok', message: 'memory-recall skill present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-recall skill' });
  }

  if (signals.hasHygiene) {
    score += 8;
    findings.push({ level: 'ok', message: 'memory-hygiene skill present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-hygiene skill' });
    recommendations.push('dokion memory init . --pattern memory-hygiene-loop');
  }

  if (signals.hasVerifier) {
    score += 8;
    findings.push({ level: 'ok', message: 'memory-verifier skill present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-verifier skill' });
    recommendations.push('dokion memory init . --pattern durable-facts-store');
  }

  if (signals.budget) {
    score += 10;
    findings.push({ level: 'ok', message: 'memory-budget.md present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-budget.md' });
    recommendations.push('dokion memory init . --pattern retrieval-budget');
  }

  if (signals.constraints) {
    score += 6;
    findings.push({ level: 'ok', message: 'memory-constraints.md present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-constraints.md' });
  }

  if (signals.runLog) {
    score += 4;
    findings.push({ level: 'ok', message: 'memory-run-log.md present' });
  } else {
    findings.push({ level: 'warn', message: 'Missing memory-run-log.md' });
  }

  if (signals.confidenceTags) {
    score += 4;
    findings.push({ level: 'ok', message: 'Confidence tags in use' });
  }

  if (!signals.durableHasOwner) {
    score = Math.max(10, score - 8);
    findings.push({ level: 'fail', message: 'Durable section lacks owner/evidence hints' });
  }

  if (signals.secretHit) {
    score = Math.max(10, score - 15);
    findings.push({ level: 'fail', message: 'Possible secret material detected in memory files' });
  }

  score = Math.min(100, Math.max(0, score));
  const level = levelFor(score, signals);

  const assessment =
    level === 'M0'
      ? 'Ad-hoc memory — scaffold MEMORY.md and a state file this week.'
      : level === 'M1'
        ? 'Structured memory — add hygiene loop (and keep durable writes manual).'
        : level === 'M2'
          ? 'Budgeted memory — gate durable promotions with verifier/human.'
          : 'Gated durable memory — maintain hygiene cadence and CI score gate.';

  return {
    target: root,
    score,
    level,
    levelLabel: levelLabel(level),
    assessment,
    signals,
    findings,
    recommendations: [...new Set(recommendations)],
  };
}

export function formatMemoryAuditHuman(result: MemoryAuditResult): string {
  const lines: string[] = [];
  lines.push(`Memory Ready: ${result.score}/100  ·  ${result.level} (${result.levelLabel})`);
  lines.push('');
  lines.push(result.assessment);
  lines.push('');

  const ok = result.findings.filter((f) => f.level === 'ok');
  const warn = result.findings.filter((f) => f.level === 'warn');
  const fail = result.findings.filter((f) => f.level === 'fail');

  if (ok.length) {
    lines.push('OK');
    for (const f of ok) lines.push(`  ✓ ${f.message}`);
    lines.push('');
  }
  if (warn.length) {
    lines.push('WARN');
    for (const f of warn) lines.push(`  ! ${f.message}`);
    lines.push('');
  }
  if (fail.length) {
    lines.push('FAIL');
    for (const f of fail) lines.push(`  ✗ ${f.message}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
