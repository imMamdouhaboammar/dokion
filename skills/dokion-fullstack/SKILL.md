# dokion-fullstack

## Metadata
- **Version**: 1.0.0
- **Scope**: Production-grade fullstack web application generation
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.4+ (strict mode)

## Description
The `dokion-fullstack` skill generates vertically-sliced, type-safe fullstack applications. It enforces Server Components by default, colocates related logic by feature, and uses tRPC with Prisma to eliminate API contract drift. The stack is optimized for SaaS platforms, internal dashboards, and content systems.

## Activation Triggers
Use this skill when the user requests:
- A "fullstack app", "web application", or "dashboard"
- Next.js with a database (PostgreSQL, MySQL, or SQLite via Prisma)
- Authentication, authorization, or user management
- Type-safe APIs between frontend and backend
- Admin panels, CRUD operations, or data tables

## Tech Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15 | App Router, SSR, API routes |
| Language | TypeScript 5.4+ | End-to-end type safety |
| Styling | Tailwind CSS 3.4+ | Utility-first CSS |
| UI Library | shadcn/ui | Accessible, composable components |
| API Layer | tRPC 11 | Type-safe RPC over HTTP |
| Database | PostgreSQL 15+ | Primary relational datastore |
| ORM | Prisma 5+ | Schema definition, migrations, queries |
| Auth | Lucia v3 | Session-based authentication |
| Validation | Zod | Runtime input/output validation |
| Testing | Vitest + Playwright | Unit/integration + E2E |
| Env Safety | t3-env | Runtime environment validation |
| Deployment | Docker + Docker Compose | Containerized local & production |

## Project Structure
Generate projects using this structure. Do not deviate without architectural justification.

