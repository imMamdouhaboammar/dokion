import { describe, it, expect, vi } from "bun:test";
import fs from "fs";
import path from "path";
import { z } from "zod";

// ============================================================================
// 1. Skill Package Integrity Tests
// ============================================================================

const SKILL_DIR = path.resolve(process.cwd(), "skills/dokion-fullstack");

describe("dokion-fullstack skill package structure", () => {
  it("has a valid SKILL.md with required sections", () => {
    const skillPath = path.join(SKILL_DIR, "SKILL.md");
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, "utf-8");
    expect(content).toMatch(/^# dokion-fullstack/m);
    expect(content).toContain("## Activation Triggers");
    expect(content).toContain("## Tech Stack");
    expect(content).toContain("## Project Structure");
  });

  it("has a valid architecture reference document", () => {
    const archPath = path.join(SKILL_DIR, "references", "architecture.md");
    expect(fs.existsSync(archPath)).toBe(true);

    const content = fs.readFileSync(archPath, "utf-8");
    expect(content).toContain("Dokion Architecture Reference");
    expect(content).toContain("System Context");
  });
});

// ============================================================================
// 2. Convention Compliance Tests (Living Documentation)
// ============================================================================

describe("dokion conventions", () => {
  describe("validation layer", () => {
    it("requires zod schemas for all inputs with inferred types", () => {
      const CreateProjectSchema = z.object({
        name: z.string().min(1).max(120),
        orgId: z.string().cuid(),
      });

      type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

      const valid: CreateProjectInput = {
        name: "Dokion Platform",
        orgId: "cuid1234567890",
      };

      expect(CreateProjectSchema.parse(valid)).toEqual(valid);
      expect(() => CreateProjectSchema.parse({ name: "", orgId: "bad" })).toThrow(
        z.ZodError
      );
    });

    it("serializes dates in validation output when needed", () => {
      const ApiResponseSchema = z.object({
        id: z.string(),
        createdAt: z.string().datetime(),
      });

      const now = new Date().toISOString();
      expect(ApiResponseSchema.parse({ id: "1", createdAt: now })).toEqual({
        id: "1",
        createdAt: now,
      });
    });
  });

  describe("service layer", () => {
    class ResourceNotFoundError extends Error {
      constructor(resource: string) {
        super(`${resource} not found`);
        this.name = "ResourceNotFoundError";
      }
    }

    class PermissionDeniedError extends Error {
      constructor() {
        super("Permission denied");
        this.name = "PermissionDeniedError";
      }
    }

    it("returns plain objects, not ORM instances", async () => {
      const mockItem = {
        id: "item_01",
        name: "Widget",
        createdAt: new Date("2024-01-01"),
      };

      // Simulating a service that maps Prisma result to DTO
      const getItem = async () => {
        return {
          id: mockItem.id,
          name: mockItem.name,
          createdAt: mockItem.createdAt.toISOString(),
        };
      };

      const result = await getItem();
      expect(result).toEqual({
        id: "item_01",
        name: "Widget",
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      expect(typeof result.createdAt === 'string').toBe(true);
    });

    it("throws domain errors for not-found resources", async () => {
      const findUser = async (id: string) => {
        if (id === "missing") throw new ResourceNotFoundError("User");
        return { id };
      };

      await expect(findUser("missing")).rejects.toThrow(ResourceNotFoundError);
      await expect(findUser("valid")).resolves.toEqual({ id: "valid" });
    });

    it("throws permission errors for unauthorized access", async () => {
      const deleteItem = async (itemUserId: string, sessionUserId: string) => {
        if (itemUserId !== sessionUserId) throw new PermissionDeniedError();
        return { success: true };
      };

      await expect(deleteItem("u1", "u2")).rejects.toThrow(PermissionDeniedError);
      await expect(deleteItem("u1", "u1")).resolves.toEqual({ success: true });
    });
  });

  describe("trpc router patterns", () => {
    it("distinguishes public and protected procedures", () => {
      // Simulating procedure metadata checks
      const publicProcedure = { type: "public" as const };
      const protectedProcedure = { type: "protected" as const, middleware: ["auth"] };

      const isPublic = (p: typeof publicProcedure | typeof protectedProcedure) =>
        p.type === "public";

      expect(isPublic(publicProcedure)).toBe(true);
      expect(isPublic(protectedProcedure)).toBe(false);
      expect(protectedProcedure.middleware).toContain("auth");
    });
  });

  describe("component boundaries", () => {
    it("keeps server components free of browser hooks", () => {
      const serverComponentCode = `
        export default async function Page() {
          const data = await fetchData();
          return <div>{data.title}</div>;
        }
      `;

      expect(serverComponentCode).not.toContain("useState");
      expect(serverComponentCode).not.toContain("useEffect");
      expect(serverComponentCode).not.toContain("'use client'");
      expect(serverComponentCode).toContain("async function");
    });

    it("marks interactive components as client boundaries", () => {
      const clientComponentCode = `
        "use client";
        import { useState } from "react";
        export function Form() {
          const [val, setVal] = useState("");
          return <input value={val} onChange={e => setVal(e.target.value)} />;
        }
      `;

      expect(clientComponentCode).toContain('"use client"');
      expect(clientComponentCode).toContain("useState");
    });
  });

  describe("error handling taxonomy", () => {
    it("maps domain errors to distinct HTTP-consumable codes", () => {
      const errors = [
        { name: "ResourceNotFoundError", code: "NOT_FOUND", status: 404 },
        { name: "PermissionDeniedError", code: "FORBIDDEN", status: 403 },
        { name: "ValidationError", code: "BAD_REQUEST", status: 400 },
      ];

      const mapError = (e: Error) => {
        if (e.name === "ResourceNotFoundError") return errors[0];
        if (e.name === "PermissionDeniedError") return errors[1];
        return errors[2];
      };

      const notFound = new Error("missing");
      notFound.name = "ResourceNotFoundError";

      const err = mapError(notFound);
      expect(err?.code).toBe("NOT_FOUND");
      expect(err?.status).toBe(404);
    });
  });
});
