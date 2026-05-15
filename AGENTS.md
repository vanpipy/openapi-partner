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
8. Vite plugin for build-time type fetching

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
├── app/                    # Next.js App Router pages
│   ├── actions/           # Server actions (project, token, tasks)
│   ├── api/               # API routes
│   │   ├── tasks/        # SSE events, download
│   │   ├── files/        # File downloads
│   │   ├── public/       # Public download links
│   │   └── auth/         # Authentication
│   └── projects/          # Project management pages
├── components/             # React components
│   ├── project/          # ProjectForm, ProjectList
│   ├── token/            # TokenManager
│   └── task/             # TaskProgress (SSE-powered)
├── lib/                   # Core business logic
│   ├── auth.ts           # Token generation/validation
│   ├── db/               # Database schema & connection
│   ├── generator.ts      # OpenAPI type generator
│   └── tasks.ts          # Task lifecycle management
└── middleware.ts          # Bearer token authentication

packages/
└── vite-plugin-openapi-partner/  # Vite plugin for type fetching
```

## Database Schema

### Projects
- `id` (PK), `name`, `specUrl`, `specType`, `specVersion`
- `wasConvertedFromSwagger2`, `outputPath`, `apiVersion`, `baseUrl`
- `isActive`, `createdAt`, `updatedAt`

### Tokens
- `id` (PK), `projectId` (FK), `name`, `tokenHash`
- `permissions` (JSON: read/write/admin), `expiresAt`
- `isActive`, `lastUsedAt`, `createdAt`

### Tasks
- `id` (PK, UUID), `projectId` (FK), `status` (PENDING/PROCESSING/SUCCESS/FAILED)
- `errorMessage`, `executionLog`, `startedAt`, `completedAt`, `createdAt`
- `outputDir`, `outputFiles`, `outputSize`, `downloadCount`, `publicToken`

### Users
- `id` (PK), `username`, `passwordHash`, `role`
- `createdAt`, `updatedAt`

### Sessions
- `id` (PK), `userId` (FK), `expiresAt`, `createdAt`

### Configs
- `id` (PK), `key`, `value`, `type`, `environment`
- `description`, `validation`, `createdAt`, `updatedAt`, `deletedAt`

### ConfigHistory
- `id` (PK), `configId` (FK), `oldValue`, `newValue`
- `changedBy` (FK), `changedAt`, `changeReason`

## Agent Guidelines

### 1. TDD Enforcement (Constitution §3)
Every implementation MUST follow:
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Optimize for readability

### 2. Test Framework
- Use **bun test** for unit tests
- Use **Playwright** for E2E tests
- Test naming: `describe > it` pattern

### 3. Code Quality
- Run `bun test` before commits
- Run `tsc --noEmit` for type checking
- No `node_modules/` in git

### 4. Commit Convention
```
<type>(<scope>): <subject>

Types: feat, fix, test, chore, refactor, docs, style, perf, ci, build, revert
Scope: auth, db, api, ui, generator, etc.
```

### 5. Security (Constitution §6)
- All tokens hashed with SHA-256
- Middleware validates Bearer tokens
- Permission-based access (read/write/admin)
- Public download tokens use UUID

## Key Commands

```bash
# Install dependencies
bun install

# Run unit tests
bun test

# Run E2E tests
bun playwright test

# Type check
bunx tsc --noEmit

# Start dev server
bun --bun run dev

# Docker build
docker compose build

# Create release tag
git tag v0.1.0
git push origin v0.1.0
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

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks/[id]/events` | Token | SSE task stream |
| GET | `/api/tasks/[id]/download` | Token | Download as ZIP |
| GET | `/api/files/[taskId]/[file]` | Token | Download single file |
| GET | `/api/public/[token]` | None | Public download (no auth) |
| POST | Server Actions | - | CRUD operations |

## Development Workflow

1. Read project documentation
2. Create test in `__tests__/` or `*.test.ts`
3. Implement in `src/lib/` or `src/app/`
4. Run `bun test` to verify
5. Commit with conventional message
6. Push to trigger CI/CD pipeline

## CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **ci.yml** | push/PR to main | lint, test, build |
| **e2e.yml** | push/PR to main | Playwright E2E tests |
| **release.yml** | git tags `v*` | Docker build, GitHub release |
| **dependabot.yml** | weekly | Auto-update dependencies |

### CI Pipeline

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Lint   │ ──▶ │  Test   │ ──▶ │  Build  │
│ (tsc)   │     │ (bun)   │     │ (next)  │
└─────────┘     └─────────┘     └─────────┘
```

### Release Pipeline

```
┌─────────────┐     ┌─────────────┐
│ Push tag v* │ ──▶ │ Docker Build │ ──▶ GHCR Image
└─────────────┘     └─────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ GitHub Release   │
                   └─────────────────┘
```

### Local Hooks

| Hook | Purpose |
|------|---------|
| **pre-commit** | Runs lint-staged on staged files (tsc + tests) |
| **commit-msg** | Validates conventional commit format |

## Workflow Files

```
.github/
├── dependabot.yml          # Dependency updates (weekly)
└── workflows/
    ├── ci.yml              # Lint → Test → Build
    ├── e2e.yml             # Playwright E2E tests
    └── release.yml          # Docker + Release on tags

.husky/
├── pre-commit            # Run lint-staged
└── commit-msg           # Validate commit format
```

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
