# Swagger Partner - API Type Automation Platform

> Automated TypeScript type generation from Swagger/OpenAPI specifications

## Features

- 📦 **Centralized Swagger URL Management** - Store and manage multiple OpenAPI specifications
- 🔄 **Automated Type Generation** - Generate TypeScript types using swagger-typescript-api
- 🔐 **Token-Based Authentication** - SHA-256 hashed API tokens with permissions
- ⚡ **Real-Time Updates** - Server-Sent Events (SSE) for task status monitoring
- 📊 **Task Lifecycle Tracking** - Full audit trail from pending to completion

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite + Drizzle ORM |
| Auth | Bearer Tokens (SHA-256) |
| Runtime | Bun |
| Container | Docker |

## Quick Start

### Prerequisites

- Bun 1.x
- Node.js 18+ (for Next.js)
- Docker (optional)

### Installation

```bash
# Install dependencies
bun install

# Run database migrations
bunx drizzle-kit generate
bunx drizzle-kit migrate

# Start development server
bun --bun run dev
```

### Docker Deployment

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server actions
│   │   ├── project.ts     # Project CRUD
│   │   ├── token.ts       # Token management
│   │   └── tasks.ts       # Task operations
│   ├── api/
│   │   └── tasks/
│   │       └── [taskId]/
│   │           └── events/ # SSE endpoint
│   └── projects/          # Pages
├── components/             # React components
│   ├── project/            # ProjectForm, ProjectList
│   ├── token/              # TokenManager
│   └── task/               # TaskProgress
├── lib/                    # Core modules
│   ├── auth.ts            # Token generation/validation
│   ├── db/
│   │   ├── schema.ts     # Drizzle schema
│   │   └── index.ts      # DB connection
│   ├── generator.ts       # Type generator
│   └── tasks.ts           # Task lifecycle
└── middleware.ts          # Auth middleware
```

## Usage

### 1. Create a Project

```typescript
import { createProject } from '@/app/actions/project';

const result = await createProject({
  name: 'Pet Store API',
  swaggerUrl: 'https://petstore.swagger.io/v2/swagger.json',
  outputPath: './generated',
});
```

### 2. Generate API Token

```typescript
import { createProjectToken } from '@/app/actions/token';

const result = await createProjectToken({
  projectId: 1,
  name: 'Production Key',
  permissions: ['read', 'write'],
  expiresInDays: 90,
});

console.log(result.data.token); // Save this - shown only once!
```

### 3. Trigger Type Sync

```typescript
import { triggerProjectSync } from '@/app/actions/project';

const result = await triggerProjectSync(1);
console.log(result.taskId); // Use for SSE subscription
```

### 4. Subscribe to Task Updates (SSE)

```typescript
const eventSource = new EventSource(`/api/tasks/${taskId}/events`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'status') {
    console.log('Status:', data.status);
  } else if (data.type === 'progress') {
    console.log('Progress:', data.message);
  } else if (data.type === 'completed') {
    console.log('Done! Output:', data.outputPath);
    eventSource.close();
  }
};
```

## API Authentication

Include your token in requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/types?projectId=1
```

## Database Schema

### Projects Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Project name (unique) |
| swaggerUrl | TEXT | OpenAPI specification URL |
| outputPath | TEXT | Generated types output path |
| apiVersion | TEXT | API version (optional) |
| baseUrl | TEXT | Base URL override (optional) |
| isActive | INTEGER | Active status (0/1) |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

### Tokens Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| projectId | INTEGER | Foreign key to projects |
| name | TEXT | Token name |
| tokenHash | TEXT | SHA-256 hash |
| permissions | TEXT | JSON array: ["read","write"] |
| expiresAt | TEXT | Expiration timestamp |
| isActive | INTEGER | Active status (0/1) |
| lastUsedAt | TEXT | Last usage timestamp |
| createdAt | TEXT | ISO timestamp |

### Tasks Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | UUID primary key |
| projectId | INTEGER | Foreign key to projects |
| status | TEXT | PENDING/PROCESSING/SUCCESS/FAILED |
| errorMessage | TEXT | Error details (if failed) |
| executionLog | TEXT | Execution logs |
| startedAt | TEXT | Processing start time |
| completedAt | TEXT | Completion time |
| createdAt | TEXT | Task creation time |

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Type check
bunx tsc --noEmit
```

### Test Results

```
 48 pass
 0 fail
 119 expect() calls
Ran 48 tests across 7 files
```

## Task Lifecycle

```
┌──────────┐    trigger    ┌─────────────┐
│ PENDING  │ ─────────────▶│ PROCESSING  │
└──────────┘               └─────────────┘
     ▲                           │
     │                           │
     │                      ┌────┴────┐
     │                      │         │
     ▼                      ▼         ▼
┌──────────┐          ┌─────────┐ ┌────────┐
│ (retry)  │          │ SUCCESS │ │ FAILED │
└──────────┘          └─────────┘ └────────┘
```

## Environment Variables

```env
# Required
DATABASE_URL=file:./data/config.db

# Optional
NEXT_PUBLIC_API_URL=http://localhost:3000
LOG_LEVEL=info
```

## License

MIT
