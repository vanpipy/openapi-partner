# AGENTS.md - Agent Instructions for OpenAPI Partner

## Project Overview

**OpenAPI Partner** is an **API Type Automation Platform** that provides:

1. Centralized OpenAPI/Swagger spec URL management with version auto-detection
2. Automated TypeScript type generation using swagger-typescript-api
3. Secure token-based authentication (SHA-256 hashed tokens)
4. Real-time task status via Server-Sent Events (SSE)
5. Task lifecycle tracking (pending → processing → success/failed)
6. Task-based generated files with multiple output formats
7. Download mechanisms (ZIP, individual files, public links)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Database | SQLite with Drizzle ORM |
| Auth | Bearer tokens (SHA-256 hashed) |
| Runtime | Bun |
| Container | Docker |
| Testing | Bun test, Playwright (E2E) |
| CI/CD | GitHub Actions |
| Logger | Pino |

## Supported Spec Versions

| Spec | Status | Notes |
|------|--------|-------|
| OpenAPI 3.2.x | ✅ Native | Full support |
| OpenAPI 3.1.x | ✅ Native | Full support |
| OpenAPI 3.0.x | ✅ Native | Full support |
| Swagger 2.0 | ⚙️ Auto-converts | Via swagger2openapi |

## Architecture

```
src/
├── app/
│   ├── actions/           # Server actions
│   │   ├── project.ts    # Project CRUD
│   │   ├── token.ts     # Token management
│   │   └── tasks.ts      # Task operations
│   ├── api/              # API routes
│   │   ├── tasks/
│   │   │   ├── process/route.ts    # Task processor
│   │   │   └── [id]/
│   │   │       ├── events/route.ts  # SSE endpoint
│   │   │       └── download/route.ts
│   │   ├── files/[...path]/route.ts
│   │   └── public/[token]/route.ts
│   ├── projects/         # Project pages
│   ├── login/page.tsx
│   └── page.tsx
├── components/
│   ├── project/          # Project components
│   │   ├── ProjectForm.tsx
│   │   ├── ProjectList.tsx
│   │   └── ProjectSettings.tsx
│   ├── task/
│   │   └── TaskProgress.tsx  # SSE-powered
│   ├── token/
│   │   └── TokenManager.tsx
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── auth.ts           # Token generation/validation
│   ├── db/
│   │   ├── index.ts     # Database connection
│   │   └── schema.ts    # Drizzle schema
│   ├── env.ts           # Environment validation
│   ├── events.ts        # SSE pub/sub
│   ├── generator.ts     # Type generator
│   ├── logger.ts        # Pino logger
│   ├── tasks.ts         # Task operations
│   └── utils.ts
└── middleware.ts         # Bearer token auth

__tests__/                # Unit tests (bun test)
e2e/                      # E2E tests (Playwright)
```

## Database Schema

### Projects
- `id` (PK), `name`, `specUrl`, `specType` (auto-detect/openapi3x/swagger2x)
- `specVersion`, `wasConvertedFromSwagger2`, `outputPath`
- `apiVersion`, `baseUrl`, `customTemplates`, `clientOptions`
- `isActive`, `createdBy`, `createdAt`, `updatedAt`

### Tokens
- `id` (PK), `projectId` (FK), `name`, `tokenHash`
- `permissions` (JSON: read/write/admin), `expiresAt`
- `lastUsedAt`, `createdAt`

### Tasks
- `id` (PK, UUID), `projectId` (FK), `status` (PENDING/PROCESSING/SUCCESS/FAILED)
- `errorMessage`, `executionLog`, `startedAt`, `completedAt`, `createdAt`
- `outputDir`, `outputFiles`, `outputSize`, `downloadCount`, `publicToken`

### Users (Schema only)
- `id`, `username`, `passwordHash`, `role`, `createdAt`, `updatedAt`

### Sessions (Schema only)
- `id`, `userId` (FK), `expiresAt`, `createdAt`

### Configs (Schema only)
- `id`, `key`, `value`, `type`, `environment`, `description`
- `validation`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt`

## Agent Guidelines

### 1. TDD Enforcement
Every implementation MUST follow:
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Optimize for readability

### 2. Test Framework
- Use **bun test** for unit tests
- Use **Playwright** for E2E tests
- Test naming: `describe > it` pattern
- Run `bun test` before commits

### 3. Code Quality
- Run `tsc --noEmit` for type checking
- No `node_modules/` in git
- Log important actions with logger

### 4. Commit Convention
```
<type>(<scope>): <subject>

Types: feat, fix, test, chore, refactor, docs, style, perf, ci, build, revert
Scope: auth, db, api, ui, generator, etc.
```

### 5. Security
- All tokens hashed with SHA-256
- Middleware validates Bearer tokens
- Permission-based access (read/write/admin)
- SSE endpoints public (UI session auth)
- Public download tokens use UUID

## Key Commands

```bash
# Install dependencies
bun install

# Database (Drizzle)
bun run drizzle:generate   # Generate migrations from schema changes
bun run drizzle:migrate    # Apply migrations to create/update database
bun run drizzle:studio    # Open interactive database studio

# Run unit tests
bun test
bun test __tests__ src/lib

# Run E2E tests
bun playwright test

# Type check
bunx tsc --noEmit

# Start dev server (run drizzle:migrate first if database doesn't exist)
bun --bun run dev

# Docker build
docker compose build

# Create release tag
git tag v0.1.0
git push origin v0.1.0
```

## File Naming Convention

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ProjectForm.tsx` |
| Actions | kebab-case | `project.ts` |
| Utils | kebab-case | `auth.ts` |
| Tests | Same as source | `auth.test.ts` |
| SQL Migrations | 001_<name>.sql | `001_create_tables.sql` |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks/[id]/events` | None | SSE task stream (public) |
| GET | `/api/tasks/[id]/download` | Token | Download as ZIP |
| GET | `/api/files/[taskId]/[file]` | Token | Download single file |
| GET | `/api/public/[token]` | None | Public download |
| POST | `/api/tasks/process` | - | Process tasks (internal) |

## CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **ci.yml** | push/PR to main | lint, test, build |
| **e2e.yml** | push/PR to main | Playwright E2E tests |
| **release.yml** | git tags `v*` | Docker build, GitHub release |
| **dependabot.yml** | weekly | Auto-update dependencies |

### Pipeline Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Lint   │ ──▶ │  Test   │ ──▶ │  Build  │
│ (tsc)   │     │ (bun)   │     │ (next)  │
└─────────┘     └─────────┘     └─────────┘
```

## Skills

| Skill | Purpose |
|-------|---------|
| `luban` | TDD execution |
| `fuxi` | Design & planning |
| `qiaochui` | Task decomposition |
| `gaoyao` | Quality audit |
| `brainstorming` | Explore intent & design |

## Logger

Use `logger.ts` for structured logging:

```typescript
import { logger } from '@/lib/logger';

logger.info('Task completed', { taskId, projectId });
logger.error('Failed to process', { error: err.message });
```

Logs output to `./logs/app.log` and `./logs/error.log`.
