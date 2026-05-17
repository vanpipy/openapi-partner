# OpenAPI Partner

> Automated TypeScript type generation from OpenAPI/Swagger specifications

## Features

- 📦 **Centralized Spec Management** - Store and manage multiple OpenAPI specifications
- 🔍 **Spec Version Auto-Detection** - Automatically detects OpenAPI 3.x or Swagger 2.0
- 🔄 **Automated Type Generation** - Generate TypeScript types using swagger-typescript-api
- 📁 **Task-Based Output** - Each generation creates a versioned directory
- 📥 **Multiple Download Options** - ZIP archive, individual files, or public links
- ⚡ **Real-Time Updates** - Server-Sent Events (SSE) for task status monitoring
- 🔐 **Token-Based Auth** - SHA-256 hashed API tokens with permissions
- 📊 **Structured Logging** - Pino logger with file output

## Supported Spec Versions

| Spec | Support | Notes |
|------|---------|-------|
| OpenAPI 3.2.x | ✅ | Full support |
| OpenAPI 3.1.x | ✅ | Full support |
| OpenAPI 3.0.x | ✅ | Full support |
| Swagger 2.0 | ⚙️ | Auto-converts |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite + Drizzle ORM |
| Auth | Bearer Tokens (SHA-256) |
| Runtime | Bun |
| Container | Docker |
| Testing | Bun test, Playwright |
| Logger | Pino |

## Quick Start

```bash
# Install dependencies
bun install

# Database setup (first time only)
bun run drizzle:migrate

# Start development server
bun --bun run dev
```

## Docker

```bash
docker compose up -d
```

## Project Structure

```
src/
├── app/
│   ├── actions/           # Server actions
│   ├── api/              # API routes
│   └── projects/         # Pages
├── components/
│   ├── project/          # Project components
│   ├── task/            # TaskProgress
│   ├── token/           # TokenManager
│   └── ui/              # shadcn/ui
└── lib/
    ├── auth.ts           # Token auth
    ├── db/               # Schema & connection
    ├── events.ts         # SSE pub/sub
    ├── generator.ts      # Type generator
    ├── logger.ts         # Pino logger
    └── tasks.ts          # Task operations
```

## Usage

### 1. Create Project

```typescript
import { createProject } from '@/app/actions/project';

await createProject({
  name: 'Pet Store API',
  specUrl: 'https://petstore.swagger.io/v2/swagger.json',
  specType: 'auto-detect',
});
```

### 2. Generate Token

```typescript
import { createProjectToken } from '@/app/actions/token';

const result = await createProjectToken({
  projectId: 1,
  name: 'Production Key',
  permissions: ['read', 'write'],
});
// Save the token - shown only once!
```

### 3. Trigger Sync

```typescript
import { triggerProjectSync } from '@/app/actions/project';

const result = await triggerProjectSync(1);
console.log(result.taskId);
```

### 4. SSE Updates

```typescript
const eventSource = new EventSource(`/api/tasks/${taskId}/events`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'completed') {
    console.log('Done!', data.outputPath);
  }
};
```

### 5. Download Files

```bash
# ZIP (token required)
curl -H "Authorization: Bearer $TOKEN" \
  /api/tasks/{taskId}/download -o task.zip

# Single file (token required)
curl -H "Authorization: Bearer $TOKEN" \
  /api/files/{taskId}/api.ts

# Public (no auth)
curl /api/public/{publicToken} -o types.zip
```

## Generated Files

```
./generated/
└── tasks/
    └── {task-id}/
        ├── manifest.json
        ├── api.ts
        ├── data-contracts.ts
        ├── http-client.ts
        └── route-types.ts
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks/[id]/events` | None | SSE stream |
| GET | `/api/tasks/[id]/download` | Token | ZIP download |
| GET | `/api/files/[taskId]/[file]` | Token | Single file |
| GET | `/api/public/[token]` | None | Public download |

## Database Schema

### Projects
`id`, `name`, `specUrl`, `specType`, `specVersion`, `wasConvertedFromSwagger2`, `outputPath`, `apiVersion`, `baseUrl`, `isActive`, `createdAt`, `updatedAt`

### Tokens
`id`, `projectId`, `name`, `tokenHash`, `permissions`, `expiresAt`, `lastUsedAt`, `createdAt`

### Tasks
`id`, `projectId`, `status`, `errorMessage`, `executionLog`, `startedAt`, `completedAt`, `outputDir`, `outputFiles`, `outputSize`, `downloadCount`, `publicToken`, `createdAt`

## Testing

```bash
bun test                    # All tests
bun test __tests__ src/lib  # Unit tests only
bun playwright test        # E2E tests
bunx tsc --noEmit          # Type check
```

## Environment Variables

```env
DATABASE_URL=file:./data/config.db
NEXT_PUBLIC_API_URL=http://localhost:3000
LOG_LEVEL=info
```

## License

MIT
