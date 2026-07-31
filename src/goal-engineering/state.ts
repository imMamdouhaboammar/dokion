import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DokionError } from "../core/errors.ts";

export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "BLOCKED" | "CLEARED";

export interface GoalProgressUpdate {
  timestamp: string;
  message: string;
  completed?: boolean;
  blockedReason?: string;
}

export interface GoalState {
  objective: string;
  status: GoalStatus;
  doneCondition: string;
  startedAt: string;
  updatedAt: string;
  turnsCount: number;
  progressLog: GoalProgressUpdate[];
  blockedReason?: string | undefined;
}

export class GoalStateEngine {
  private static getStatePath(projectDir: string): string {
    return join(projectDir, ".dokion", "goal-state.json");
  }

  public static loadState(projectDir: string): GoalState | null {
    const path = this.getStatePath(projectDir);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as GoalState;
    } catch {
      return null;
    }
  }

  public static saveState(projectDir: string, state: GoalState): void {
    const dokionDir = join(projectDir, ".dokion");
    if (!existsSync(dokionDir)) {
      mkdirSync(dokionDir, { recursive: true });
    }
    const path = this.getStatePath(projectDir);
    writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
  }

  public static initGoal(projectDir: string, objective: string, doneCondition = "Verifier script / tests pass"): GoalState {
    const now = new Date().toISOString();
    const state: GoalState = {
      objective,
      status: "ACTIVE",
      doneCondition,
      startedAt: now,
      updatedAt: now,
      turnsCount: 1,
      progressLog: [
        {
          timestamp: now,
          message: `Goal initiated: "${objective}"`,
        },
      ],
    };
    this.saveState(projectDir, state);
    return state;
  }

  public static updateProgress(
    projectDir: string,
    message: string,
    completed = false,
    blockedReason?: string
  ): GoalState {
    let state = this.loadState(projectDir);
    const now = new Date().toISOString();

    if (!state) {
      state = {
        objective: message,
        status: completed ? "COMPLETED" : blockedReason ? "BLOCKED" : "ACTIVE",
        doneCondition: "Verifier check",
        startedAt: now,
        updatedAt: now,
        turnsCount: 1,
        progressLog: [],
        blockedReason,
      };
    }

    state.turnsCount += 1;
    state.updatedAt = now;

    if (completed) {
      state.status = "COMPLETED";
      delete state.blockedReason;
    } else if (blockedReason) {
      state.status = "BLOCKED";
      state.blockedReason = blockedReason;
    } else if (state.status === "PAUSED") {
      state.status = "ACTIVE";
    }

    state.progressLog.push({
      timestamp: now,
      message,
      ...(completed ? { completed: true } : {}),
      ...(blockedReason ? { blockedReason } : {}),
    });

    this.saveState(projectDir, state);
    return state;
  }

  public static pauseGoal(projectDir: string): GoalState {
    const state = this.loadState(projectDir);
    if (!state) {
      throw new DokionError("GOAL_NOT_FOUND", "No active goal state found to pause.");
    }
    state.status = "PAUSED";
    state.updatedAt = new Date().toISOString();
    state.progressLog.push({
      timestamp: state.updatedAt,
      message: "Goal paused by user.",
    });
    this.saveState(projectDir, state);
    return state;
  }

  public static resumeGoal(projectDir: string): GoalState {
    const state = this.loadState(projectDir);
    if (!state) {
      throw new DokionError("GOAL_NOT_FOUND", "No goal state found to resume.");
    }
    state.status = "ACTIVE";
    state.updatedAt = new Date().toISOString();
    state.progressLog.push({
      timestamp: state.updatedAt,
      message: "Goal resumed.",
    });
    this.saveState(projectDir, state);
    return state;
  }

  public static clearGoal(projectDir: string): GoalState | null {
    const state = this.loadState(projectDir);
    if (state) {
      state.status = "CLEARED";
      state.updatedAt = new Date().toISOString();
      state.progressLog.push({
        timestamp: state.updatedAt,
        message: "Goal cleared.",
      });
      this.saveState(projectDir, state);
    }
    return state;
  }
}
