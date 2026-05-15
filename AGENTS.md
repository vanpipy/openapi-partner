# AGENTS.md - Agent Instructions for Swagger Partner

## Project Overview

**Swagger Partner** is an **API Type Automation Platform** that provides:

1. Centralized Swagger/OpenAPI URL management
2. Automated TypeScript type generation using swagger-typescript-api
3. Secure token-based authentication (SHA-256 hashed tokens)
4. Real-time task status via Server-Sent Events (SSE)
5. Task lifecycle tracking (pending → processing → success/failed)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Database | SQLite with Drizzle ORM |
| Auth | Bearer tokens (SHA-256 hashed) |
| Runtime | Bun |
| Container | Docker |

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── actions/           # Server actions (project, token, tasks)
│   ├── api/               # API routes
│   │   └── tasks/        # SSE endpoint for task events
│   └── projects/          # Project management pages
├── components/             # React components
│   ├── project/          # ProjectForm, ProjectList
│   ├── token/            # TokenManager
│   └── task/             # TaskProgress (SSE-powered)
├── lib/                   # Core business logic
│   ├── auth.ts           # Token generation/validation
│   ├── db/               # Database schema & connection
│   ├── generator.ts      # Swagger type generator
│   └── tasks.ts          # Task lifecycle management
└── middleware.ts          # Bearer token authentication
```

## Database Schema

### Projects
- `id` (PK), `name`, `swaggerUrl`, `outputPath`, `apiVersion`, `baseUrl`
- `isActive`, `createdAt`, `updatedAt`

### Tokens
- `id` (PK), `projectId` (FK), `name`, `tokenHash`
- `permissions` (JSON: read/write/admin), `expiresAt`
- `isActive`, `lastUsedAt`, `createdAt`

### Tasks
- `id` (PK, UUID), `projectId` (FK), `status` (PENDING/PROCESSING/SUCCESS/FAILED)
- `errorMessage`, `executionLog`, `startedAt`, `completedAt`, `createdAt`

## Agent Guidelines

### 1. TDD Enforcement (Constitution §3)
Every implementation MUST follow:
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Optimize for readability

### 2. Test Framework
- Use **bun test** for all tests
- Test naming: `describe > it` pattern
- Coverage: 48 passing tests (as of v1.0)

### 3. Code Quality
- Run `bun test` before commits
- Run `tsc --noEmit` for type checking
- No `node_modules/` in git

### 4. Commit Convention
```
<type>(<scope>): <subject>

Types: feat, fix, test, chore, refactor
Scope: T1-T10, auth, db, api, ui, etc.
```

### 5. Security (Constitution §6)
- All tokens hashed with SHA-256
- Middleware validates Bearer tokens
- Permission-based access (read/write/admin)

## Key Commands

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bunx tsc --noEmit

# Start dev server
bun --bun run dev

# Docker build
docker compose build
```

## File Naming Convention (Constitution)

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ProjectForm.tsx` |
| Actions | kebab-case | `project.ts` |
| Utils | kebab-case | `auth.ts` |
| Tests | Same as source | `auth.test.ts` |
| SQL Migrations | 001_<name>.sql | `001_create_tables.sql` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/types?projectId=X` | Fetch generated types |
| GET | `/api/tasks/[id]/events` | SSE task stream |
| POST | Server Actions | CRUD operations |

## Development Workflow

1. Read `TWO.md` for full specification
2. Create test in `__tests__/` or `*.test.ts`
3. Implement in `src/lib/` or `src/app/`
4. Run `bun test` to verify
5. Commit with conventional message

## Skills

| Skill | Purpose |
|-------|---------|
| `luban` | TDD execution |
| `fuxi` | Design & planning |
| `qiaochui` | Task decomposition |
| `gaoyao` | Quality audit |

## Constitution Compliance

All agents MUST follow `.specify/memory/constitution.md`:
- TypeScript safety practices
- Zero-cost abstractions
- TDD cycle enforcement
- English documentation
- Public API documentation
